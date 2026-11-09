import { addYears } from "date-fns";
import type { PaymentMethod, PrismaClient } from "@prisma/client";
import { verifyPaymentReference } from "@/lib/integrations/payments";

type Db = PrismaClient;

export function annualAmountFromMonthly(priceMonthly: number) {
  return Math.round(priceMonthly * 12 * 100) / 100;
}

export function billingPeriod(from = new Date()) {
  const periodStart = from;
  const periodEnd = addYears(from, 1);
  return { periodStart, periodEnd, year: periodStart.getFullYear() };
}

export async function nextPlatformInvoiceNumber(
  db: Db,
  orgId: string,
  year: number,
) {
  const count = await db.platformInvoice.count({
    where: { organizationId: orgId, year },
  });
  return `INV-${year}-${String(count + 1).padStart(3, "0")}`;
}

/** Activate org + subscription from a paid platform invoice (period = expiry window). */
export async function activatePaidPlatformInvoice(
  db: Db,
  invoiceId: string,
  opts?: {
    paymentMethod?: string;
    paymentReference?: string;
    mode?: string;
    createdById?: string;
  },
) {
  const invoice = await db.platformInvoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice) throw new Error("Invoice not found");

  const paymentMethod = opts?.paymentMethod || invoice.paymentMethod;
  const paymentReference = opts?.paymentReference || invoice.paymentReference;

  await db.platformInvoice.update({
    where: { id: invoiceId },
    data: {
      status: "PAID",
      paidAt: new Date(),
      paymentMethod,
      paymentReference,
    },
  });

  if (invoice.subscriptionId) {
    await db.orgSubscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        status: "ACTIVE",
        startedAt: invoice.periodStart,
        endsAt: invoice.periodEnd,
        renewsAt: invoice.periodEnd,
      },
    });
  }

  await db.organization.update({
    where: { id: invoice.organizationId },
    data: {
      status: "ACTIVE",
      trialEndsAt: null,
    },
  });

  await db.platformBillingEvent.create({
    data: {
      invoiceId,
      type: "MARKED_PAID",
      body: `Payment recorded${paymentReference ? ` · ref ${paymentReference}` : ""}`,
      mode: opts?.mode || "checkout",
      createdById: opts?.createdById,
    },
  });

  return invoice;
}

export function evaluateSaasPayment(input: {
  method: PaymentMethod;
  reference: string;
  amount: number;
}) {
  return verifyPaymentReference(input);
}
