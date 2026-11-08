"use server";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgSession, requirePerm } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { writeAudit } from "@/lib/audit";
import { sendEmailMessage } from "@/lib/integrations/email";
import { policyEmailTemplate } from "@/lib/underwriting";
import { ensureUnderwritingDepartment } from "@/lib/org-defaults";
import { notifyUser } from "@/lib/notifications";

async function assertUnderwritingAccess() {
  const session = await requireOrgSession();
  const role = session.user.role;
  if (
    role === "ORG_ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "MANAGER"
  ) {
    return session;
  }
  if (role === "DEPARTMENT_USER" && session.user.departmentId) {
    const dept = await db.department.findFirst({
      where: {
        id: session.user.departmentId,
        organizationId: session.organizationId,
        name: "Underwriting",
      },
    });
    if (dept) return session;
  }
  // Agents with sales write can also help in underwriting queue
  await requirePerm("sales:write");
  return session;
}

async function getEmailConnectorConfig(organizationId: string) {
  const connector = await db.channelConnector.findFirst({
    where: { organizationId, channel: "EMAIL", enabled: true },
    orderBy: { createdAt: "asc" },
  });
  if (!connector?.config || typeof connector.config !== "object") return null;
  return connector.config as {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    fromEmail?: string;
    mock?: boolean;
  };
}

export async function assignPolicyNumber(orderId: string, policyNumber: string) {
  const session = await assertUnderwritingAccess();
  const number = policyNumber.trim().toUpperCase();
  if (!number || number.length < 3) {
    throw new Error("Enter a valid policy number");
  }

  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!order) throw new Error("Order not found");

  const clash = await db.order.findFirst({
    where: {
      organizationId: session.organizationId,
      policyNumber: number,
      NOT: { id: orderId },
    },
    select: { id: true, number: true },
  });
  if (clash) {
    throw new Error(`Policy ${number} already used on Order #${clash.number}`);
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      policyNumber: number,
      underwritingStatus:
        order.underwritingStatus === "PENDING"
          ? "IN_REVIEW"
          : order.underwritingStatus,
    },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    ticketId: order.ticketId || undefined,
    type: "STATUS_CHANGE",
    title: `Policy # ${number} allocated`,
    body: `Order #${order.number}`,
  });

  await writeAudit({
    organizationId: session.organizationId,
    userId: session.user.id,
    action: "underwriting.policy_number",
    entity: "Order",
    entityId: orderId,
  });

  revalidatePath("/underwriting");
  revalidatePath(`/underwriting/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
  revalidatePath(`/sales/orders/${orderId}`);
  return { policyNumber: number };
}

export async function uploadPolicyDocument(orderId: string, formData: FormData) {
  const session = await assertUnderwritingAccess();
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!order) throw new Error("Order not found");
  if (!order.policyNumber) {
    throw new Error("Allocate a policy number before attaching the document");
  }

  const raw = formData.get("file");
  const file = raw instanceof File ? raw : null;
  if (!file || file.size <= 0) {
    throw new Error("Policy document required — choose a file and try again");
  }
  if (file.size > 15 * 1024 * 1024) throw new Error("Max 15MB");

  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "./uploads");
  const dir = path.join(
    uploadRoot,
    session.organizationId,
    "customers",
    order.customerId,
    "policies"
  );
  await mkdir(dir, { recursive: true });

  const safeName = (file.name || "policy.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  const stored = `${Date.now()}-${safeName}`;
  const fullPath = path.join(dir, stored);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length) throw new Error("Uploaded file was empty");
  await writeFile(fullPath, buffer);

  const label = `Policy — ${order.policyNumber}`;

  // Replace previous issued policy doc for this order
  const existing = await db.attachment.findMany({
    where: { orderId, label: { startsWith: "Policy —" } },
  });
  for (const a of existing) {
    await db.attachment.delete({ where: { id: a.id } }).catch(() => null);
  }

  const attachment = await db.attachment.create({
    data: {
      customerId: order.customerId,
      orderId,
      label,
      fileName: file.name,
      filePath: fullPath,
      mimeType: file.type || "application/pdf",
      size: file.size,
    },
  });

  await db.order.update({
    where: { id: orderId },
    data: {
      underwritingStatus: "POLICY_READY",
      policyIssuedAt: new Date(),
    },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    ticketId: order.ticketId || undefined,
    type: "SYSTEM",
    title: `Policy document attached`,
    body: `${label} · ${file.name}`,
  });

  revalidatePath("/underwriting");
  revalidatePath(`/underwriting/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
  return { id: attachment.id, label };
}

/** Issue policy: email customer with standard wording + attached policy PDF. */
export async function issueAndEmailPolicy(orderId: string) {
  const session = await assertUnderwritingAccess();
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
    include: {
      customer: true,
      organization: { select: { name: true } },
      attachments: {
        where: { label: { startsWith: "Policy —" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!order) throw new Error("Order not found");
  if (!order.policyNumber) throw new Error("Allocate policy number first");
  const doc = order.attachments[0];
  if (!doc) throw new Error("Attach policy document first");
  if (!order.customer.email?.includes("@")) {
    throw new Error("Customer has no email address — add email on the customer profile");
  }

  const fileBuffer = await readFile(doc.filePath);
  const { subject, body } = policyEmailTemplate({
    orgName: order.organization.name,
    customerName: order.customer.name,
    policyNumber: order.policyNumber,
    orderNumber: order.number,
  });

  const config = await getEmailConnectorConfig(session.organizationId);
  const result = await sendEmailMessage(
    config,
    order.customer.email,
    subject,
    body,
    [
      {
        filename: doc.fileName,
        content: fileBuffer,
        contentType: doc.mimeType || "application/pdf",
      },
    ]
  );

  if (!result.ok) {
    throw new Error(result.error || "Failed to send policy email");
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      underwritingStatus: "SENT",
      policySentAt: new Date(),
      policyIssuedAt: order.policyIssuedAt || new Date(),
    },
  });

  // Close linked underwriting ticket if present
  if (order.ticketId) {
    const resolved = await db.ticketStage.findFirst({
      where: { organizationId: session.organizationId, key: "RESOLVED" },
    });
    if (resolved) {
      await db.ticket.update({
        where: { id: order.ticketId },
        data: { stageId: resolved.id },
      });
      await db.ticketNote.create({
        data: {
          ticketId: order.ticketId,
          authorId: session.user.id,
          body: `Policy ${order.policyNumber} emailed to ${order.customer.email} (${result.mode}).`,
          isInternal: true,
        },
      });
    }
  }

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    ticketId: order.ticketId || undefined,
    type: "EMAIL",
    title: `Policy emailed to customer`,
    body: `${order.policyNumber} → ${order.customer.email} (${result.mode})`,
  });

  await writeAudit({
    organizationId: session.organizationId,
    userId: session.user.id,
    action: "underwriting.policy_sent",
    entity: "Order",
    entityId: orderId,
  });

  try {
    const { routeOrderToOperations } = await import("@/lib/module-routing");
    await routeOrderToOperations({
      organizationId: session.organizationId,
      orderId,
      createdById: session.user.id,
      reason: `Policy ${order.policyNumber} emailed — ready for ops`,
    });
  } catch (err) {
    console.error("operations route failed", err);
  }

  revalidatePath("/underwriting");
  revalidatePath(`/underwriting/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
  revalidatePath("/operations");
  revalidatePath("/department");

  return {
    mode: result.mode,
    email: order.customer.email,
    policyNumber: order.policyNumber,
  };
}

export async function listUnderwritingAssignees() {
  const session = await assertUnderwritingAccess();
  const dept = await ensureUnderwritingDepartment(
    db,
    session.organizationId
  );

  const users = await db.user.findMany({
    where: {
      organizationId: session.organizationId,
      active: true,
      OR: [
        { departmentId: dept.id },
        { role: { in: ["ORG_ADMIN", "MANAGER", "AGENT", "DEPARTMENT_USER"] } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      departmentId: true,
    },
    orderBy: [{ name: "asc" }],
  });

  // Prefer Underwriting department agents at the top
  return users.sort((a, b) => {
    const aUw = a.departmentId === dept.id ? 0 : 1;
    const bUw = b.departmentId === dept.id ? 0 : 1;
    if (aUw !== bUw) return aUw - bUw;
    return a.name.localeCompare(b.name);
  });
}

export async function assignUnderwritingCase(
  orderId: string,
  assigneeId: string | null
) {
  const session = await assertUnderwritingAccess();
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
    include: { customer: { select: { id: true, name: true } } },
  });
  if (!order) throw new Error("Order not found");

  let assigneeName: string | null = null;
  if (assigneeId) {
    const user = await db.user.findFirst({
      where: {
        id: assigneeId,
        organizationId: session.organizationId,
        active: true,
      },
      select: { id: true, name: true },
    });
    if (!user) throw new Error("Agent not found");
    assigneeName = user.name;
  }

  await db.order.update({
    where: { id: orderId },
    data: { underwritingAssigneeId: assigneeId },
  });

  // Keep linked underwriting ticket in sync when present
  if (order.ticketId) {
    await db.ticket
      .update({
        where: { id: order.ticketId },
        data: { assigneeId },
      })
      .catch(() => null);
  }

  if (assigneeId) {
    await notifyUser({
      organizationId: session.organizationId,
      userId: assigneeId,
      title: `Underwriting case assigned — Order #${order.number}`,
      body: order.customer.name,
      href: `/underwriting/${orderId}`,
    });
  }

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    ticketId: order.ticketId || undefined,
    type: "ASSIGNMENT",
    title: assigneeId
      ? `Underwriting assigned to ${assigneeName}`
      : "Underwriting unassigned",
    body: `Order #${order.number}`,
  });

  await writeAudit({
    organizationId: session.organizationId,
    userId: session.user.id,
    action: "underwriting.assign",
    entity: "Order",
    entityId: orderId,
  });

  revalidatePath("/underwriting");
  revalidatePath(`/underwriting/${orderId}`);
  revalidatePath("/department");
  return { assigneeId, assigneeName };
}

export async function ensureUnderwritingSetup() {
  const session = await requirePerm("settings:manage");
  const dept = await ensureUnderwritingDepartment(
    db,
    session.organizationId
  );
  revalidatePath("/settings/departments");
  revalidatePath("/underwriting");
  return { id: dept.id, name: dept.name };
}
