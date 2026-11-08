import { db } from "@/lib/db";
import { getOrgModule } from "@/lib/modules";
import { notifyUser } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";

/** Notify Finance department users when a sale needs payment clearance. */
export async function routeSaleToFinance(params: {
  organizationId: string;
  orderId: string;
  createdById?: string | null;
}) {
  const mod = await getOrgModule(params.organizationId, "FINANCE");
  if (!mod?.enabled || !mod.departmentId) return null;

  const order = await db.order.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    include: { customer: { select: { name: true } } },
  });
  if (!order) return null;
  if (["PAID", "CLEARED"].includes(order.paymentStatus)) return null;

  await db.order.update({
    where: { id: order.id },
    data: { financeStatus: "PENDING" },
  });

  const agents = await db.user.findMany({
    where: {
      organizationId: params.organizationId,
      departmentId: mod.departmentId,
      active: true,
    },
    select: { id: true },
  });

  await Promise.all(
    agents.map((a) =>
      notifyUser({
        organizationId: params.organizationId,
        userId: a.id,
        title: `Finance — Order #${order.number}`,
        body: `${order.customer.name} · payment ${order.paymentStatus}`,
        href: `/finance/${order.id}`,
      })
    )
  );

  await logActivity({
    organizationId: params.organizationId,
    userId: params.createdById || undefined,
    customerId: order.customerId,
    orderId: order.id,
    type: "FORWARD",
    title: `Order #${order.number} → Finance`,
    body: "Awaiting payment confirmation",
  });

  return { departmentId: mod.departmentId };
}

/** Open / bump Operations case after policy issued or payment cleared. */
export async function routeOrderToOperations(params: {
  organizationId: string;
  orderId: string;
  createdById?: string | null;
  reason?: string;
}) {
  const mod = await getOrgModule(params.organizationId, "OPERATIONS");
  if (!mod?.enabled || !mod.departmentId) return null;

  const order = await db.order.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    include: { customer: { select: { name: true } } },
  });
  if (!order) return null;

  if (order.operationsStatus === "DONE") return null;

  await db.order.update({
    where: { id: order.id },
    data: {
      operationsStatus:
        order.operationsStatus === "IN_PROGRESS" ? "IN_PROGRESS" : "PENDING",
    },
  });

  const agents = await db.user.findMany({
    where: {
      organizationId: params.organizationId,
      departmentId: mod.departmentId,
      active: true,
    },
    select: { id: true },
  });

  await Promise.all(
    agents.map((a) =>
      notifyUser({
        organizationId: params.organizationId,
        userId: a.id,
        title: `Operations — Order #${order.number}`,
        body:
          params.reason ||
          `${order.customer.name} ready for activation / handoff`,
        href: `/operations/${order.id}`,
      })
    )
  );

  await logActivity({
    organizationId: params.organizationId,
    userId: params.createdById || undefined,
    customerId: order.customerId,
    orderId: order.id,
    type: "FORWARD",
    title: `Order #${order.number} → Operations`,
    body: params.reason || "Awaiting ops completion",
  });

  return { departmentId: mod.departmentId };
}
