"use server";

import { revalidatePath } from "next/cache";
import { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { addMonths } from "date-fns";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { writeAudit } from "@/lib/audit";
import { runAutomations } from "@/lib/automation";
import { createCustomer } from "@/server/actions/customers";
import {
  parseOrderFormValues,
  serializeProductFormConfig,
  type OrderFormValue,
  type ProductFormField,
  type ProductPriceRule,
} from "@/lib/product-form";
import { upsertOrderPolicyDocument } from "@/server/actions/policy-document";

type LineItem = {
  productId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount?: number;
  taxPercent?: number;
  formValues?: OrderFormValue[];
};

export async function createOrder(input: {
  customerId?: string;
  newCustomer?: {
    name: string;
    phone?: string;
    email?: string;
    cnic?: string;
    address?: string;
    city?: string;
  };
  items: LineItem[];
  paymentMethod: PaymentMethod;
  dealId?: string;
  ticketId?: string;
  conversationId?: string;
  discount?: number;
  notes?: string;
  installmentCount?: number;
}) {
  const session = await requirePerm("sales:write");
  const organizationId = session.organizationId;

  let customerId = input.customerId;
  if (!customerId && input.newCustomer?.name) {
    const c = await createCustomer(input.newCustomer);
    customerId = c.id;
  }
  if (!customerId) throw new Error("Customer required");
  if (!input.items?.length) throw new Error("At least one product required");

  const lines = input.items.map((item) => {
    const discount = item.discount || 0;
    const taxPercent = item.taxPercent || 0;
    const base = item.unitPrice * item.quantity - discount;
    const tax = (base * taxPercent) / 100;
    return {
      ...item,
      discount,
      taxPercent,
      lineTotal: base + tax,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const lineDiscount = lines.reduce((s, l) => s + (l.discount || 0), 0);
  const orderDiscount = input.discount || 0;
  const tax = lines.reduce(
    (s, l) => s + ((l.unitPrice * l.quantity - (l.discount || 0)) * (l.taxPercent || 0)) / 100,
    0
  );
  const total = Math.max(0, subtotal - lineDiscount - orderDiscount + tax);

  const org = await db.organization.update({
    where: { id: organizationId },
    data: { orderCounter: { increment: 1 } },
  });

  const order = await db.order.create({
    data: {
      organizationId,
      number: org.orderCounter,
      customerId,
      dealId: input.dealId || null,
      ticketId: input.ticketId || null,
      createdById: session.user.id,
      paymentMethod: input.paymentMethod,
      status: "PENDING",
      paymentStatus: "PENDING",
      subtotal,
      discount: lineDiscount + orderDiscount,
      tax,
      total,
      notes: input.notes,
      items: {
        create: lines.map((l) => {
          const formValues = parseOrderFormValues(l.formValues);
          return {
            productId: l.productId || null,
            name: l.name,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            discount: l.discount || 0,
            taxPercent: l.taxPercent || 0,
            lineTotal: l.lineTotal,
            ...(formValues.length
              ? {
                  formValues: formValues as unknown as Prisma.InputJsonValue,
                }
              : {}),
          };
        }),
      },
    },
  });

  if (input.paymentMethod === "INSTALLMENT") {
    const count = Math.max(2, input.installmentCount || 3);
    const amount = Math.round((total / count) * 100) / 100;
    let remaining = total;
    for (let i = 1; i <= count; i++) {
      const amt = i === count ? remaining : amount;
      remaining = Math.round((remaining - amt) * 100) / 100;
      await db.installment.create({
        data: {
          orderId: order.id,
          number: i,
          amount: amt,
          dueDate: addMonths(new Date(), i - 1),
          status: "PENDING",
        },
      });
    }
  } else {
    await db.payment.create({
      data: {
        orderId: order.id,
        method: input.paymentMethod,
        status: input.paymentMethod === "CHEQUE" ? "RECEIVED" : "PENDING",
        amount: total,
      },
    });
  }

  await logActivity({
    organizationId,
    userId: session.user.id,
    customerId,
    orderId: order.id,
    dealId: input.dealId,
    ticketId: input.ticketId,
    type: "SALE",
    title: `Order #${order.number} created`,
    body: `${input.paymentMethod} — total ${total}`,
  });

  await writeAudit({
    organizationId,
    userId: session.user.id,
    action: "order.create",
    entity: "Order",
    entityId: order.id,
  });

  await runAutomations({
    organizationId,
    trigger: "SALE_CREATED",
    context: {
      paymentMethod: input.paymentMethod,
      total: String(total),
    },
  });

  // Policy PDF (customer + vehicle form + payment status) → customer documents
  try {
    await upsertOrderPolicyDocument(order.id);
  } catch (err) {
    console.error("policy PDF failed", err);
  }

  // Every new sale → Underwriting queue (when module enabled)
  try {
    const { routeSaleToUnderwriting } = await import("@/lib/underwriting");
    await routeSaleToUnderwriting({
      organizationId,
      orderId: order.id,
      createdById: session.user.id,
      createdByName: session.user.name || "Sales",
    });
  } catch (err) {
    console.error("underwriting route failed", err);
  }

  // Unpaid sales → Finance queue (when module enabled)
  try {
    const { routeSaleToFinance } = await import("@/lib/module-routing");
    await routeSaleToFinance({
      organizationId,
      orderId: order.id,
      createdById: session.user.id,
    });
  } catch (err) {
    console.error("finance route failed", err);
  }

  revalidatePath("/sales/orders");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");
  revalidatePath("/underwriting");
  revalidatePath("/finance");
  revalidatePath("/department");

  // Plain object only — Prisma Decimal cannot cross the Server→Client boundary
  return {
    id: order.id,
    number: order.number,
    customerId: order.customerId,
    paymentMethod: order.paymentMethod,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    tax: Number(order.tax),
    total: Number(order.total),
  };
}

export async function confirmPayment(
  orderId: string,
  paymentId: string,
  data: { reference?: string; notes?: string; status?: PaymentStatus }
) {
  const session = await requirePerm("payment:confirm");
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
  });
  if (!order) throw new Error("Not found");

  const status = data.status || "PAID";
  await db.payment.update({
    where: { id: paymentId },
    data: {
      status,
      reference: data.reference,
      notes: data.notes,
      paidAt: status === "PAID" || status === "CLEARED" ? new Date() : null,
      confirmedById: session.user.id,
    },
  });

  if (status === "PAID" || status === "CLEARED") {
    await db.order.update({
      where: { id: orderId },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        financeStatus: "CLEARED",
      },
    });
  } else if (status === "BOUNCED") {
    await db.order.update({
      where: { id: orderId },
      data: { paymentStatus: "BOUNCED", financeStatus: "IN_REVIEW" },
    });
  }

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    type: "PAYMENT",
    title: `Payment ${status}`,
    body: data.reference,
  });

  // Refresh policy PDF so payment confirmation status is current
  try {
    await upsertOrderPolicyDocument(orderId);
  } catch (err) {
    console.error("policy PDF refresh failed", err);
  }

  if (status === "PAID" || status === "CLEARED") {
    try {
      const { routeOrderToOperations } = await import("@/lib/module-routing");
      const { isModuleEnabled } = await import("@/lib/modules");
      const uwOn = await isModuleEnabled(session.organizationId, "UNDERWRITING");
      // If UW is off, Finance clearance should still open Ops
      if (!uwOn) {
        await routeOrderToOperations({
          organizationId: session.organizationId,
          orderId,
          createdById: session.user.id,
          reason: "Payment cleared — ready for ops",
        });
      }
    } catch (err) {
      console.error("operations route failed", err);
    }
  }

  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath("/sales/orders");
  revalidatePath(`/customers/${order.customerId}`);
  revalidatePath("/finance");
  revalidatePath(`/finance/${orderId}`);
  revalidatePath("/operations");
  revalidatePath("/dashboard");
}

export async function markInstallmentPaid(
  orderId: string,
  installmentId: string,
  reference?: string
) {
  const session = await requirePerm("payment:confirm");
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
    include: { installments: true },
  });
  if (!order) throw new Error("Not found");

  await db.installment.update({
    where: { id: installmentId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      reference,
    },
  });

  const remaining = await db.installment.count({
    where: { orderId, status: { not: "PAID" } },
  });

  await db.order.update({
    where: { id: orderId },
    data: {
      status: remaining === 0 ? "PAID" : "PARTIAL",
      paymentStatus: remaining === 0 ? "PAID" : "PARTIAL",
    },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    type: "PAYMENT",
    title: "Installment paid",
    body: reference,
  });

  try {
    await upsertOrderPolicyDocument(orderId);
  } catch (err) {
    console.error("policy PDF refresh failed", err);
  }

  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
  revalidatePath("/dashboard");
}

export async function createProduct(data: {
  name: string;
  sku?: string;
  description?: string;
  unitPrice: number;
  taxPercent?: number;
  category?: string;
  imageUrl?: string;
  formFields?: ProductFormField[];
  priceRule?: ProductPriceRule | null;
}) {
  const session = await requirePerm("settings:manage");
  const formFields = serializeProductFormConfig(
    data.formFields || [],
    data.priceRule
  );
  const product = await db.product.create({
    data: {
      organizationId: session.organizationId,
      name: data.name,
      sku: data.sku,
      description: data.description,
      unitPrice: data.unitPrice,
      taxPercent: data.taxPercent || 0,
      category: data.category,
      imageUrl: data.imageUrl || null,
      formFields: formFields as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/sales/products");
  revalidatePath("/dashboard");
  return {
    id: product.id,
    name: product.name,
    unitPrice: Number(product.unitPrice),
    taxPercent: Number(product.taxPercent),
  };
}

export async function updateProduct(
  id: string,
  data: Partial<{
    name: string;
    sku: string | null;
    description: string | null;
    unitPrice: number;
    taxPercent: number;
    category: string | null;
    imageUrl: string | null;
    active: boolean;
    formFields: ProductFormField[];
    priceRule: ProductPriceRule | null;
  }>
) {
  const session = await requirePerm("settings:manage");
  const existing = await db.product.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) throw new Error("Product not found");

  const product = await db.product.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.sku !== undefined ? { sku: data.sku } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.unitPrice !== undefined ? { unitPrice: data.unitPrice } : {}),
      ...(data.taxPercent !== undefined ? { taxPercent: data.taxPercent } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.formFields !== undefined
        ? {
            formFields: serializeProductFormConfig(
              data.formFields,
              data.priceRule
            ) as unknown as Prisma.InputJsonValue,
          }
        : {}),
    },
  });
  revalidatePath("/sales/products");
  revalidatePath("/dashboard");
  return {
    id: product.id,
    name: product.name,
    unitPrice: Number(product.unitPrice),
    taxPercent: Number(product.taxPercent),
  };
}

export async function deleteProduct(id: string) {
  const session = await requirePerm("settings:manage");
  const existing = await db.product.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, name: true },
  });
  if (!existing) throw new Error("Product not found");

  // Keep order/ticket history — only unlink catalog product
  await db.orderItem.updateMany({
    where: { productId: id },
    data: { productId: null },
  });
  await db.ticket.updateMany({
    where: { productId: id, organizationId: session.organizationId },
    data: { productId: null },
  });

  await db.product.delete({ where: { id } });

  await writeAudit({
    organizationId: session.organizationId,
    userId: session.user.id,
    action: "product.delete",
    entity: "Product",
    entityId: id,
  });

  revalidatePath("/sales/products");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Sync CRM products → WhatsApp catalog.
 * Mock (default): stamps whatsappProductId locally.
 * Live: uses first enabled WA connector token when mock is off (Meta Catalog API placeholder).
 */
export async function syncWhatsAppCatalog() {
  const session = await requirePerm("settings:manage");
  const organizationId = session.organizationId;

  const connector = await db.channelConnector.findFirst({
    where: { organizationId, channel: "WHATSAPP", enabled: true },
    orderBy: { createdAt: "asc" },
  });
  const config =
    connector?.config && typeof connector.config === "object"
      ? (connector.config as Record<string, unknown>)
      : {};
  const mock = config.mock !== false;
  const token = String(config.accessToken || "").trim();

  const products = await db.product.findMany({
    where: { organizationId, active: true },
  });

  let synced = 0;
  const now = new Date();

  for (const product of products) {
    let whatsappProductId = product.whatsappProductId;

    if (!mock && token) {
      // Live Meta Catalog push would go here with a catalog_id in connector config.
      // Until catalog_id is configured, still assign a stable local WA id for inbox send.
      whatsappProductId =
        product.whatsappProductId ||
        `wa_${product.sku || product.id.slice(-8)}`;
    } else {
      whatsappProductId =
        product.whatsappProductId ||
        `mock_${product.sku || product.id.slice(-8)}`;
    }

    await db.product.update({
      where: { id: product.id },
      data: { whatsappProductId, catalogSyncedAt: now },
    });
    synced += 1;
  }

  revalidatePath("/sales/products");
  revalidatePath("/inbox");
  return { synced, mode: mock || !token ? "MOCK" : "LIVE" as const };
}

export async function createDeal(input: {
  title: string;
  customerId: string;
  value?: number;
  closeDate?: string;
  stageKey?: string;
  conversationId?: string;
}) {
  const session = await requirePerm("sales:write");
  const organizationId = session.organizationId;
  const stage = await db.dealStage.findFirst({
    where: {
      organizationId,
      key: (input.stageKey as never) || "LEAD",
    },
  });
  if (!stage) throw new Error("Deal stages missing");

  const org = await db.organization.update({
    where: { id: organizationId },
    data: { dealCounter: { increment: 1 } },
  });

  const deal = await db.deal.create({
    data: {
      organizationId,
      number: org.dealCounter,
      title: input.title,
      customerId: input.customerId,
      stageId: stage.id,
      ownerId: session.user.id,
      value: input.value || 0,
      closeDate: input.closeDate ? new Date(input.closeDate) : null,
      conversationId: input.conversationId || null,
    },
  });

  revalidatePath("/sales/deals");
  return deal;
}

export async function updateDealStage(dealId: string, stageId: string) {
  const session = await requirePerm("sales:write");
  await db.deal.update({
    where: { id: dealId },
    data: { stageId },
  });
  revalidatePath("/sales/deals");
}
