"use server";

import bcrypt from "bcryptjs";
import { PaymentMethod, SaaSPlanKey } from "@prisma/client";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { signIn } from "@/lib/auth";
import { seedOrganizationDefaults } from "@/lib/org-defaults";
import {
  activatePaidPlatformInvoice,
  annualAmountFromMonthly,
  billingPeriod,
  evaluateSaasPayment,
  nextPlatformInvoiceNumber,
} from "@/lib/saas-billing";
import { slugify } from "@/lib/utils";
import { requireOrgSession } from "@/lib/session";

export type CheckoutState = { error?: string; ok?: boolean; pendingReview?: boolean };

const PAID_METHODS: PaymentMethod[] = ["JAZZCASH", "BANK"];

function parseMethod(raw: string): PaymentMethod {
  const m = raw.toUpperCase() as PaymentMethod;
  if (!PAID_METHODS.includes(m)) return "JAZZCASH";
  return m;
}

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

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

/**
 * Public SaaS checkout: create org + annual invoice + payment.
 * Verified payment → ACTIVE plan until periodEnd (expiry).
 * Pending review → invoice SENT, org TRIAL for 3 days grace.
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
  const method = parseMethod(String(formData.get("paymentMethod") || "JAZZCASH"));
  const reference = String(formData.get("paymentReference") || "").trim();

  if (!orgName || !name || !email || password.length < 6) {
    return { error: "Fill all fields (password min 6 characters)." };
  }
  if (!reference) {
    return { error: "Enter your payment reference / transaction ID." };
  }

  const plan = await db.saaSPlan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.active) return { error: "Plan not found." };
  if (Number(plan.priceMonthly) <= 0 || (plan.trialDays && plan.trialDays > 0)) {
    return { error: "This plan is free — use the demo signup instead." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "Email already registered. Sign in and renew from Billing." };

  const amount = annualAmountFromMonthly(Number(plan.priceMonthly));
  const { periodStart, periodEnd, year } = billingPeriod();
  const verify = evaluateSaasPayment({ method, reference, amount });

  let slug = slugify(orgName) || "org";
  if (await db.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const pendingReview = verify.status === "PENDING_REVIEW";
  const rejected = verify.status === "REJECTED";
  if (rejected) {
    return { error: verify.message || "Payment reference rejected." };
  }

  let invoiceId = "";
  try {
    const paidNow = verify.ok && !pendingReview;
    const result = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          status: paidNow ? "ACTIVE" : "TRIAL",
          planId: plan.id,
          trialEndsAt: pendingReview
            ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            : null,
          users: {
            create: {
              email,
              name,
              passwordHash,
              role: "ORG_ADMIN",
            },
          },
        },
      });

      const sub = await tx.orgSubscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: paidNow ? "ACTIVE" : "TRIAL",
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
          status: paidNow ? "PAID" : "SENT",
          periodStart,
          periodEnd,
          dueAt: periodStart,
          paidAt: paidNow ? new Date() : null,
          billingEmail: email,
          paymentMethod: method,
          paymentReference: reference,
          notes: `Annual ${plan.name} · ${periodEnd.toISOString().slice(0, 10)}`,
        },
      });

      await tx.platformBillingEvent.create({
        data: {
          invoiceId: invoice.id,
          type: paidNow ? "MARKED_PAID" : "INVOICE_SENT",
          body: paidNow
            ? `Checkout verified · ${method}`
            : `Awaiting confirmation · ${method}`,
          mode: verify.mock ? "sandbox" : "live",
          toEmail: email,
        },
      });

      return { orgId: org.id, invoiceId: invoice.id };
    });
    invoiceId = result.invoiceId;

    await seedOrganizationDefaults(db, result.orgId);
    await writeAudit({
      organizationId: result.orgId,
      action: "org.checkout",
      entity: "Organization",
      entityId: result.orgId,
      meta: {
        plan: plan.key,
        invoiceId,
        paymentStatus: verify.status,
        periodEnd: periodEnd.toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/paymentMethod|paymentReference|Unknown column/i.test(message)) {
      await ensureInvoicePaymentColumns();
      return {
        error: "Billing schema updated — please submit payment again.",
      };
    }
    console.error("[checkoutPaidPlan]", err);
    return { error: "Checkout failed. Try again or contact support." };
  }

  revalidatePath("/admin/orgs");
  revalidatePath("/pricing");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: pendingReview
        ? `/settings/billing?pending=${invoiceId}`
        : "/inbox?welcome=1",
    });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof AuthError) {
      return {
        ok: true,
        pendingReview,
        error: "Account created — sign in to continue.",
      };
    }
    throw error;
  }

  return { ok: true, pendingReview };
}

/** Logged-in ORG_ADMIN: pay / renew current plan (creates invoice tied to expiry). */
export async function renewOrPaySubscription(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const session = await requireOrgSession();
  if (session.user.role !== "ORG_ADMIN") {
    return { error: "Only org admins can pay." };
  }

  const method = parseMethod(String(formData.get("paymentMethod") || "JAZZCASH"));
  const reference = String(formData.get("paymentReference") || "").trim();
  const invoiceIdExisting = String(formData.get("invoiceId") || "").trim();

  if (!reference) {
    return { error: "Enter your payment reference / transaction ID." };
  }

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
  const verify = evaluateSaasPayment({ method, reference, amount });
  if (verify.status === "REJECTED") {
    return { error: verify.message || "Payment rejected." };
  }

  let invoiceId = invoiceIdExisting;

  try {
    if (invoiceId) {
      const inv = await db.platformInvoice.findFirst({
        where: {
          id: invoiceId,
          organizationId: org.id,
          status: { in: ["DRAFT", "SENT", "OVERDUE"] },
        },
      });
      if (!inv) return { error: "Invoice not found or already paid." };

      await db.platformInvoice.update({
        where: { id: inv.id },
        data: {
          paymentMethod: method,
          paymentReference: reference,
          status: verify.ok && verify.status !== "PENDING_REVIEW" ? inv.status : "SENT",
          notes: `${inv.notes || ""}\nPayment submitted · ${method} · ${reference}`.trim(),
        },
      });

      if (verify.ok && verify.status !== "PENDING_REVIEW") {
        await activatePaidPlatformInvoice(db, inv.id, {
          paymentMethod: method,
          paymentReference: reference,
        });
      }
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
          status:
            verify.ok && verify.status !== "PENDING_REVIEW" ? "PAID" : "SENT",
          periodStart,
          periodEnd,
          dueAt: new Date(),
          paidAt:
            verify.ok && verify.status !== "PENDING_REVIEW" ? new Date() : null,
          billingEmail: session.user.email,
          paymentMethod: method,
          paymentReference: reference,
          notes: `Renewal checkout · ${org.plan.name}`,
        },
      });
      invoiceId = invoice.id;

      if (verify.ok && verify.status !== "PENDING_REVIEW") {
        await activatePaidPlatformInvoice(db, invoice.id, {
          paymentMethod: method,
          paymentReference: reference,
        });
      } else {
        await db.platformBillingEvent.create({
          data: {
            invoiceId: invoice.id,
            type: "INVOICE_SENT",
            body: `Renewal awaiting confirmation · ${method} · ${reference}`,
            mode: "sandbox",
            toEmail: session.user.email,
          },
        });
      }
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

  if (verify.status === "PENDING_REVIEW") {
    return {
      ok: true,
      pendingReview: true,
      error:
        "Payment submitted for review. Your plan stays active after an admin confirms the reference.",
    };
  }

  return { ok: true };
}
