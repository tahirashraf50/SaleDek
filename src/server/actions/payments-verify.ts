"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { verifyPaymentReference } from "@/lib/integrations/payments";
import { confirmPayment } from "@/server/actions/sales";
import { logActivity } from "@/lib/activity";

export async function verifyAndConfirmPayment(input: {
  orderId: string;
  paymentId: string;
  reference: string;
  autoConfirm?: boolean;
}) {
  const session = await requirePerm("payment:confirm");
  const order = await db.order.findFirst({
    where: { id: input.orderId, organizationId: session.organizationId },
    include: { payments: true },
  });
  if (!order) throw new Error("Order not found");

  const payment = order.payments.find((p) => p.id === input.paymentId);
  if (!payment) throw new Error("Payment not found");

  const result = verifyPaymentReference({
    method: order.paymentMethod,
    reference: input.reference,
    amount: Number(order.total),
  });

  await db.payment.update({
    where: { id: payment.id },
    data: {
      reference: input.reference,
      notes: `[${result.status}] ${result.message}`,
    },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: order.customerId,
    orderId: order.id,
    type: "PAYMENT",
    title: `Payment verify: ${result.status}`,
    body: result.message,
    meta: result as object,
  });

  if (result.ok && result.status === "VERIFIED" && input.autoConfirm !== false) {
    await confirmPayment(order.id, payment.id, {
      reference: input.reference,
      notes: result.message,
      status: order.paymentMethod === "CHEQUE" ? "CLEARED" : "PAID",
    });
  }

  revalidatePath(`/sales/orders/${order.id}`);
  return result;
}
