"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { requireModuleAccess } from "@/lib/modules";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notifications";

async function assertOps() {
  const session = await requireOrgSession();
  await requireModuleAccess(session, "OPERATIONS");
  return session;
}

export async function listOperationsAssignees() {
  const session = await assertOps();
  const mod = await db.organizationModule.findUnique({
    where: {
      organizationId_key: {
        organizationId: session.organizationId,
        key: "OPERATIONS",
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

export async function assignOperationsCase(
  orderId: string,
  assigneeId: string | null
) {
  const session = await assertOps();
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
      operationsAssigneeId: assigneeId,
      operationsStatus:
        order.operationsStatus === "DONE" ? "DONE" : "IN_PROGRESS",
    },
  });

  if (assigneeId) {
    await notifyUser({
      organizationId: session.organizationId,
      userId: assigneeId,
      title: `Operations case assigned — Order #${order.number}`,
      body: order.customer.name,
      href: `/operations/${orderId}`,
    });
  }

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    type: "ASSIGNMENT",
    title: assigneeId
      ? `Operations assigned to ${name}`
      : "Operations unassigned",
  });

  revalidatePath("/operations");
  revalidatePath(`/operations/${orderId}`);
  return { assigneeId, assigneeName: name };
}

export async function updateOperationsCase(
  orderId: string,
  data: {
    status: "PENDING" | "IN_PROGRESS" | "DONE";
    note?: string;
  }
) {
  const session = await assertOps();
  const order = await db.order.findFirst({
    where: { id: orderId, organizationId: session.organizationId },
  });
  if (!order) throw new Error("Order not found");

  await db.order.update({
    where: { id: orderId },
    data: {
      operationsStatus: data.status,
      operationsNote:
        data.note !== undefined
          ? data.note.trim() || null
          : undefined,
    },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId,
    type: "STATUS_CHANGE",
    title: `Operations → ${data.status.replace(/_/g, " ")}`,
    body: data.note || undefined,
  });

  revalidatePath("/operations");
  revalidatePath(`/operations/${orderId}`);
  revalidatePath(`/customers/${order.customerId}`);
  return { status: data.status };
}
