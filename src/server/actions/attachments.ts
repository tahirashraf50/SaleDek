"use server";

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";

export async function uploadTicketAttachment(ticketId: string, formData: FormData) {
  const session = await requirePerm("tickets:write");
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, organizationId: session.organizationId },
  });
  if (!ticket) throw new Error("Ticket not found");

  const file = formData.get("file") as File | null;
  if (!file || !file.size) throw new Error("File required");
  if (file.size > 8 * 1024 * 1024) throw new Error("Max 8MB");

  const uploadRoot = process.env.UPLOAD_DIR || "./uploads";
  const dir = path.join(uploadRoot, session.organizationId, "tickets", ticketId);
  await mkdir(dir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stored = `${Date.now()}-${safeName}`;
  const fullPath = path.join(dir, stored);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  const attachment = await db.attachment.create({
    data: {
      ticketId,
      customerId: ticket.customerId,
      fileName: file.name,
      filePath: fullPath,
      mimeType: file.type || null,
      size: file.size,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  return attachment;
}

export async function uploadCustomerAttachment(
  customerId: string,
  formData: FormData
) {
  const session = await requirePerm("customers:write");
  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: session.organizationId },
  });
  if (!customer) throw new Error("Customer not found");

  const file = formData.get("file") as File | null;
  if (!file || !file.size) throw new Error("File required");
  if (file.size > 12 * 1024 * 1024) throw new Error("Max 12MB");

  const label = String(formData.get("label") || "").trim() || null;

  const uploadRoot = process.env.UPLOAD_DIR || "./uploads";
  const dir = path.join(
    uploadRoot,
    session.organizationId,
    "customers",
    customerId
  );
  await mkdir(dir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const stored = `${Date.now()}-${safeName}`;
  const fullPath = path.join(dir, stored);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  const attachment = await db.attachment.create({
    data: {
      customerId,
      label,
      fileName: file.name,
      filePath: fullPath,
      mimeType: file.type || null,
      size: file.size,
    },
  });

  revalidatePath(`/customers/${customerId}`);
  return {
    id: attachment.id,
    label: attachment.label,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export async function deleteCustomerAttachment(attachmentId: string) {
  const session = await requirePerm("customers:write");
  const attachment = await db.attachment.findFirst({
    where: { id: attachmentId },
    include: { customer: { select: { id: true, organizationId: true } } },
  });
  if (
    !attachment?.customerId ||
    attachment.customer?.organizationId !== session.organizationId
  ) {
    throw new Error("Attachment not found");
  }

  try {
    await unlink(attachment.filePath);
  } catch {
    // file may already be gone
  }

  await db.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/customers/${attachment.customerId}`);
}
