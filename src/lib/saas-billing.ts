import { addYears } from "date-fns";
import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient;

export type CardChargeResult = {
  ok: boolean;
  status: "VERIFIED" | "REJECTED";
  message: string;
  /** Safe receipt id — never stores full PAN */
  reference: string;
  mock: boolean;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function luhnOk(pan: string) {
  let sum = 0;
  let alt = false;
  for (let i = pan.length - 1; i >= 0; i -= 1) {
    let n = Number(pan[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Sandbox card charge for SaaS checkout — credit card only. */
export function chargeCardSandbox(input: {
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  amount: number;
}): CardChargeResult {
  const name = input.cardName.trim();
  const pan = digitsOnly(input.cardNumber);
  const expiry = input.cardExpiry.trim();
  const cvc = digitsOnly(input.cardCvc);

  if (!name) {
    return {
      ok: false,
      status: "REJECTED",
      message: "Enter the name on the card.",
      reference: "",
      mock: true,
    };
  }
  if (pan.length < 13 || pan.length > 19 || !luhnOk(pan)) {
    return {
      ok: false,
      status: "REJECTED",
      message: "Enter a valid card number.",
      reference: "",
      mock: true,
    };
  }
  const expMatch = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry);
  if (!expMatch) {
    return {
      ok: false,
      status: "REJECTED",
      message: "Expiry must be MM/YY.",
      reference: "",
      mock: true,
    };
  }
  const month = Number(expMatch[1]);
  const year = 2000 + Number(expMatch[2]);
  if (month < 1 || month > 12) {
    return {
      ok: false,
      status: "REJECTED",
      message: "Invalid expiry month.",
      reference: "",
      mock: true,
    };
  }
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  if (endOfMonth < new Date()) {
    return {
      ok: false,
      status: "REJECTED",
      message: "Card is expired.",
      reference: "",
      mock: true,
    };
  }
  if (cvc.length < 3 || cvc.length > 4) {
    return {
      ok: false,
      status: "REJECTED",
      message: "Enter a valid CVC.",
      reference: "",
      mock: true,
    };
  }

  // Test decline: numbers ending in 0000
  if (pan.endsWith("0000")) {
    return {
      ok: false,
      status: "REJECTED",
      message: "Card was declined.",
      reference: "",
      mock: true,
    };
  }

  const last4 = pan.slice(-4);
  const reference = `CARD-${last4}-${Date.now().toString(36).toUpperCase()}`;
  return {
    ok: true,
    status: "VERIFIED",
    message: `Card ending ${last4} charged ${input.amount}`,
    reference,
    mock: true,
  };
}

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
