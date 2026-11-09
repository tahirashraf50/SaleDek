"use server";

import bcrypt from "bcryptjs";
import { SaaSPlanKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { seedOrganizationDefaults } from "@/lib/org-defaults";
import {
  activatePaidPlatformInvoice,
  annualAmountFromMonthly,
  billingPeriod,
  chargeCardSandbox,
  nextPlatformInvoiceNumber,
} from "@/lib/saas-billing";
import { slugify } from "@/lib/utils";
import { requireOrgSession } from "@/lib/session";
import { assertBusinessEmail } from "@/lib/business-email";
import {
  ensureUserActivationColumns,
  issueActivationEmail,
} from "@/lib/account-activation";

export type CheckoutState = { error?: string; ok?: boolean };

const CARD_METHOD = "CARD";

async function ensureInvoicePaymentColumns() {
  for (const sql of [
    "ALTER TABLE `PlatformInvoice` ADD COLUMN `paymentMethod` VARCHAR(191) NULL",
    "ALTER TABLE `PlatformInvoice` ADD COLUMN `paymentReference` VARCHAR(191) NULL",
  ]) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/Duplicate column|already exists/i.test(message)) {
        /* ignore */
      }
    }
  }
}

function readCard(formData: FormData) {
  return {
    cardName: String(formData.get("cardName") || "").trim(),
    cardNumber: String(formData.get("cardNumber") || ""),
    cardExpiry: String(formData.get("cardExpiry") || "").trim(),
    cardCvc: String(formData.get("cardCvc") || ""),
  };
}

/**
 * Public SaaS checkout: create org + annual invoice + credit card payment.
 * Verified charge → ACTIVE plan until periodEnd (expiry).
 */
export async function checkoutPaidPlan(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const orgName = String(formData.get("orgName") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const planKey = String(formData.get("plan") || "")
    .trim()
    .toUpperCase() as SaaSPlanKey;
  const card = readCard(formData);

  if (!orgName || !name || !email || password.length < 6) {
    return { error: "Fill all fields (password min 6 characters)." };
  }

  const businessError = assertBusinessEmail(email);
  if (businessError) return { error: businessError };

  const plan = await db.saaSPlan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.active) return { error: "Plan not found." };
  if (Number(plan.priceMonthly) <= 0 || (plan.trialDays && plan.trialDays > 0)) {
    return { error: "This plan is free — use the demo signup instead." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email already registered. Sign in and renew from Billing." };
  }

  const amount = annualAmountFromMonthly(Number(plan.priceMonthly));
  const { periodStart, periodEnd, year } = billingPeriod();
  const charge = chargeCardSandbox({ ...card, amount });
  if (!charge.ok) {
    return { error: charge.message || "Card payment failed." };
  }

  let slug = slugify(orgName) || "org";
  if (await db.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let userId = "";
  try {
    const result = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          status: "ACTIVE",
          planId: plan.id,
          trialEndsAt: null,
          users: {
            create: {
              email,
              name,
              passwordHash,
              role: "ORG_ADMIN",
              active: false,
            },
          },
        },
        include: { users: { where: { email }, take: 1 } },
      });

      const sub = await tx.orgSubscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: "ACTIVE",
          startedAt: periodStart,
          endsAt: periodEnd,
          renewsAt: periodEnd,
        },
      });

      const number = await nextPlatformInvoiceNumber(db, org.id, year);
      const invoice = await tx.platformInvoice.create({
        data: {
          organizationId: org.id,
          subscriptionId: sub.id,
          number,
          year,
          amount,
          status: "PAID",
          periodStart,
          periodEnd,
          dueAt: periodStart,
          paidAt: new Date(),
          billingEmail: email,
          paymentMethod: CARD_METHOD,
          paymentReference: charge.reference,
          notes: `Annual ${plan.name} · ${periodEnd.toISOString().slice(0, 10)}`,
        },
      });

      await tx.platformBillingEvent.create({
        data: {
          invoiceId: invoice.id,
          type: "MARKED_PAID",
          body: `Card checkout · ${charge.reference}`,
          mode: charge.mock ? "sandbox" : "live",
          toEmail: email,
        },
      });

      return {
        orgId: org.id,
        invoiceId: invoice.id,
        userId: org.users[0]?.id || "",
      };
    });

    userId = result.userId;
    if (!userId) {
      const created = await db.user.findUnique({ where: { email } });
      userId = created?.id || "";
    }

    await seedOrganizationDefaults(db, result.orgId);
    await writeAudit({
      organizationId: result.orgId,
      action: "org.checkout",
      entity: "Organization",
      entityId: result.orgId,
      meta: {
        plan: plan.key,
        invoiceId: result.invoiceId,
        paymentStatus: charge.status,
        periodEnd: periodEnd.toISOString(),
        pendingActivation: true,
      },
    });

    if (userId) {
      await issueActivationEmail({
        userId,
        email,
        name,
        orgName,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/paymentMethod|paymentReference|Unknown column/i.test(message)) {
      await ensureInvoicePaymentColumns();
      return {
        error: "Billing schema updated — please submit payment again.",
      };
    }
    if (/emailVerifiedAt|activationToken|Unknown column/i.test(message)) {
      await ensureUserActivationColumns();
      return {
        error: "Account schema updated — please submit payment again.",
      };
    }
    console.error("[checkoutPaidPlan]", err);
    return { error: "Checkout failed. Try again or contact support." };
  }

  revalidatePath("/admin/orgs");
  revalidatePath("/pricing");

  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

/** Logged-in ORG_ADMIN: pay / renew with credit card (extends plan expiry). */
export async function renewOrPaySubscription(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const session = await requireOrgSession();
  if (session.user.role !== "ORG_ADMIN") {
    return { error: "Only org admins can pay." };
  }

  const card = readCard(formData);
  const invoiceIdExisting = String(formData.get("invoiceId") || "").trim();

  const org = await db.organization.findUnique({
    where: { id: session.organizationId },
    include: {
      plan: true,
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!org?.plan) return { error: "No plan assigned — contact support." };
  if (Number(org.plan.priceMonthly) <= 0) {
    return { error: "Demo plans do not require payment." };
  }

  const amount = annualAmountFromMonthly(Number(org.plan.priceMonthly));
  const charge = chargeCardSandbox({ ...card, amount });
  if (!charge.ok) {
    return { error: charge.message || "Card payment failed." };
  }

  try {
    if (invoiceIdExisting) {
      const inv = await db.platformInvoice.findFirst({
        where: {
          id: invoiceIdExisting,
          organizationId: org.id,
          status: { in: ["DRAFT", "SENT", "OVERDUE"] },
        },
      });
      if (!inv) return { error: "Invoice not found or already paid." };

      await activatePaidPlatformInvoice(db, inv.id, {
        paymentMethod: CARD_METHOD,
        paymentReference: charge.reference,
        mode: charge.mock ? "sandbox" : "live",
      });
    } else {
      const sub = org.subscriptions[0];
      const base =
        sub?.endsAt && sub.endsAt > new Date() ? new Date(sub.endsAt) : new Date();
      const { periodStart, periodEnd, year } = billingPeriod(base);
      const number = await nextPlatformInvoiceNumber(db, org.id, year);

      const subId =
        sub?.id ||
        (
          await db.orgSubscription.create({
            data: {
              organizationId: org.id,
              planId: org.plan.id,
              status: "TRIAL",
              startedAt: periodStart,
              endsAt: periodEnd,
              renewsAt: periodEnd,
            },
          })
        ).id;

      const invoice = await db.platformInvoice.create({
        data: {
          organizationId: org.id,
          subscriptionId: subId,
          number,
          year,
          amount,
          status: "SENT",
          periodStart,
          periodEnd,
          dueAt: new Date(),
          billingEmail: session.user.email,
          paymentMethod: CARD_METHOD,
          paymentReference: charge.reference,
          notes: `Renewal checkout · ${org.plan.name}`,
        },
      });

      await activatePaidPlatformInvoice(db, invoice.id, {
        paymentMethod: CARD_METHOD,
        paymentReference: charge.reference,
        mode: charge.mock ? "sandbox" : "live",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/paymentMethod|paymentReference|Unknown column/i.test(message)) {
      await ensureInvoicePaymentColumns();
      return { error: "Billing schema updated — submit payment again." };
    }
    console.error("[renewOrPaySubscription]", err);
    return { error: "Payment failed. Try again." };
  }

  revalidatePath("/settings/billing");
  revalidatePath("/admin/orgs");

  return { ok: true };
}
