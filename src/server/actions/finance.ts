"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { requireModuleAccess } from "@/lib/modules";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notifications";

async function assertFinance() {
  const session = await requireOrgSession();
  await requireModuleAccess(session, "FINANCE");
  return session;
}

export async function listFinanceAssignees() {
  const session = await assertFinance();
  const mod = await db.organizationModule.findUnique({
    where: {
      organizationId_key: {
        organizationId: session.organizationId,
        key: "FINANCE",
      },
    },
  });
  return db.user.findMany({
    where: {
      organizationId: session.organizationId,
      active: true,
      OR: [
        ...(mod?.departmentId ? [{ departmentId: mod.departmentId }] : []),
        { role: { in: ["ORG_ADMIN", "MANAGER", "AGENT"] as const } },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function assignFinanceCase(
  orderId: string,
  assigneeId: string | null
) {
  const session = await assertFinance();
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
    include: { customer: { select: { name: true } } },
  });
  if (!order) throw new Error("Order not found");

  let name: string | null = null;
  if (assigneeId) {
    const u = await db.user.findFirst({
      where: { id: assigneeId, organizationId: session.organizationId },
      select: { id: true, name: true },
    });
    if (!u) throw new Error("Agent not found");
    name = u.name;
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      financeAssigneeId: assigneeId,
      financeStatus:
        order.financeStatus === "CLEARED" ? "CLEARED" : "IN_REVIEW",
    },
  });

  if (assigneeId) {
    await notifyUser({
      organizationId: session.organizationId,
      userId: assigneeId,
      title: `Finance case assigned — Order #${order.number}`,
      body: order.customer.name,
      href: `/finance/${orderId}`,
    });
  }

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    type: "ASSIGNMENT",
    title: assigneeId ? `Finance assigned to ${name}` : "Finance unassigned",
  });

  revalidatePath("/finance");
  revalidatePath(`/finance/${orderId}`);
  return { assigneeId, assigneeName: name };
}

export async function financeConfirmPayment(
  orderId: string,
  paymentId: string,
  data: {
    reference?: string;
    notes?: string;
    status?: "PAID" | "CLEARED" | "BOUNCED";
  }
) {
  const session = await assertFinance();
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
  });
  if (!order) throw new Error("Order not found");

  const payment = await db.payment.findFirst({
    where: { id: paymentId, orderId },
  });
  if (!payment) throw new Error("Payment not found");

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

    try {
      const { routeOrderToOperations } = await import("@/lib/module-routing");
      const { isModuleEnabled } = await import("@/lib/modules");
      const uwOn = await isModuleEnabled(session.organizationId, "UNDERWRITING");
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

  revalidatePath("/finance");
  revalidatePath(`/finance/${orderId}`);
  revalidatePath(`/sales/orders/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
  revalidatePath("/operations");
}

export async function financeMarkInstallmentPaid(
  orderId: string,
  installmentId: string,
  reference?: string
) {
  const session = await assertFinance();
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
  });
  if (!order) throw new Error("Order not found");

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
      financeStatus: remaining === 0 ? "CLEARED" : "IN_REVIEW",
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

  revalidatePath("/finance");
  revalidatePath(`/finance/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
}

export async function financeStartReview(orderId: string) {
  const session = await assertFinance();
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
  });
  if (!order) throw new Error("Order not found");
  if (order.financeStatus === "CLEARED") {
    throw new Error("Case already cleared");
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      financeStatus: "IN_REVIEW",
      financeAssigneeId: order.financeAssigneeId || session.user.id,
    },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    type: "STATUS_CHANGE",
    title: "Finance moved to in review",
  });

  revalidatePath("/finance");
  revalidatePath(`/finance/${orderId}`);
  return { financeStatus: "IN_REVIEW" as const };
}

export async function financeAddNote(orderId: string, body: string) {
  const session = await assertFinance();
  const note = body.trim();
  if (!note) throw new Error("Note required");

  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
    select: { id: true, customerId: true },
  });
  if (!order) throw new Error("Order not found");

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    type: "NOTE",
    title: "Finance note",
    body: note,
  });

  revalidatePath(`/finance/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
}
