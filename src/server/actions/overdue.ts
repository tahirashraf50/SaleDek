"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { runAutomations } from "@/lib/automation";
import { notifyUser } from "@/lib/notifications";

export async function markOverdueInstallments() {
  const session = await requirePerm("sales:write");
  const now = new Date();

  const overdue = await db.installment.findMany({
    where: {
      status: "PENDING",
      dueDate: { lt: now },
      order: { organizationId: session.organizationId },
    },
    include: {
      order: { select: { id: true, number: true, createdById: true, customerId: true } },
    },
  });

  for (const item of overdue) {
    await db.installment.update({
      where: { id: item.id },
      data: { status: "OVERDUE" },
    });
    await db.order.update({
      where: { id: item.orderId },
      data: { paymentStatus: "OVERDUE" },
    });

    await runAutomations({
      organizationId: session.organizationId,
      trigger: "INSTALLMENT_OVERDUE",
      context: {
        orderId: item.orderId,
        installmentId: item.id,
      },
    });

    if (item.order.createdById) {
      await notifyUser({
        organizationId: session.organizationId,
        userId: item.order.createdById,
        title: `Installment overdue — Order #${item.order.number}`,
        body: `Installment #${item.number} is past due`,
        href: `/sales/orders/${item.orderId}`,
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/sales/orders");
  return { updated: overdue.length };
}
