"use server";

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { buildPolicyPdfBuffer } from "@/lib/policy-pdf";
import { parseOrderFormValues } from "@/lib/product-form";

/**
 * Build/replace the policy PDF for an order and attach it to the customer.
 * Label: "Policy summary — Order #N"
 */
export async function upsertOrderPolicyDocument(orderId: string) {
  const order = await db.order.findFirst({
    where: { id: orderId },
    include: {
      customer: {
        include: { company: { select: { name: true } } },
      },
      items: true,
      organization: { select: { name: true } },
    },
  });
  if (!order?.customer) return null;

  const custom =
    order.customer.customData && typeof order.customer.customData === "object"
      ? (order.customer.customData as Record<string, unknown>)
      : {};

  const items = order.items.map((i) => ({
    name: i.name,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    lineTotal: Number(i.lineTotal),
    formValues: parseOrderFormValues(i.formValues),
  }));

  // Only generate when there is at least one filled form (e.g. vehicle policy)
  const hasForm = items.some((i) => i.formValues.length > 0);
  if (!hasForm) return null;

  const buffer = await buildPolicyPdfBuffer({
    orgName: order.organization.name,
    orderNumber: order.number,
    policyNumber: order.policyNumber,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.status,
    total: Number(order.total),
    notes: order.notes,
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
      email: order.customer.email,
      cnic: order.customer.cnic,
      address: order.customer.address,
      city: order.customer.city,
      companyName: order.customer.company?.name || null,
      jobTitle: typeof custom.jobTitle === "string" ? custom.jobTitle : null,
    },
    items,
  });

  const label = `Policy summary — Order #${order.number}`;
  const fileName = `policy-order-${order.number}.pdf`;

  const uploadRoot = process.env.UPLOAD_DIR || "./uploads";
  const dir = path.join(
    uploadRoot,
    order.organizationId,
    "customers",
    order.customerId,
    "policies"
  );
  await mkdir(dir, { recursive: true });

  const stored = `${Date.now()}-${fileName}`;
  const fullPath = path.join(dir, stored);
  await writeFile(fullPath, buffer);

  // Replace previous policy PDF for this order (same label)
  const existing = await db.attachment.findMany({
    where: {
      customerId: order.customerId,
      ticketId: null,
      label,
    },
  });
  for (const a of existing) {
    try {
      await unlink(a.filePath);
    } catch {
      // ignore missing file
    }
    await db.attachment.delete({ where: { id: a.id } });
  }

  const attachment = await db.attachment.create({
    data: {
      customerId: order.customerId,
      label,
      fileName,
      filePath: fullPath,
      mimeType: "application/pdf",
      size: buffer.length,
    },
  });

  return {
    id: attachment.id,
    label: attachment.label,
    fileName: attachment.fileName,
  };
}
