"use server";

import bcrypt from "bcryptjs";
import { addDays, addYears, format } from "date-fns";
import { revalidatePath } from "next/cache";
import {
  SaaSPlanKey,
  TenantStatus,
  SubscriptionStatus,
  PlatformBillingEventType,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { seedOrganizationDefaults } from "@/lib/org-defaults";
import { storeOrganizationLogo } from "@/lib/org-logo-server";
import {
  PLATFORM_NAME,
  sendPlatformEmail,
} from "@/lib/platform-email";
import { formatPlatformCurrency, slugify } from "@/lib/utils";

async function requireSuperAdmin() {
  const session = await requireSession();
  if (session.user.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function createTenant(input: {
  orgName: string;
  slug?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  planKey?: SaaSPlanKey | string;
  status?: TenantStatus | string;
  logo?: File | null;
}) {
  const session = await requireSuperAdmin();

  const orgName = input.orgName.trim();
  const adminName = input.adminName.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  const adminPassword = input.adminPassword;
  const status =
    input.status === "ACTIVE" || input.status === "TRIAL"
      ? input.status
      : "ACTIVE";

  if (!orgName || !adminName || !adminEmail || adminPassword.length < 6) {
    throw new Error("Fill all fields (password min 6 characters).");
  }

  const existingUser = await db.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) throw new Error("Admin email already registered.");

  let slug = slugify(input.slug?.trim() || orgName) || "org";
  const slugTaken = await db.organization.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;

  const planKey = (String(input.planKey || "STARTER").toUpperCase() ||
    "STARTER") as SaaSPlanKey;
  const plan =
    (await db.saaSPlan.findUnique({ where: { key: planKey } })) ||
    (await db.saaSPlan.findUnique({ where: { key: "STARTER" } }));

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const trialDays = plan?.trialDays && plan.trialDays > 0 ? plan.trialDays : null;
  const effectiveStatus =
    trialDays && input.status !== "ACTIVE" ? "TRIAL" : status;
  const trialEndsAt =
    effectiveStatus === "TRIAL"
      ? addDays(new Date(), trialDays || 14)
      : null;

  const org = await db.organization.create({
    data: {
      name: orgName,
      slug,
      status: effectiveStatus,
      planId: plan?.id,
      trialEndsAt,
      users: {
        create: {
          email: adminEmail,
          name: adminName,
          passwordHash,
          role: "ORG_ADMIN",
        },
      },
    },
  });

  if (plan) {
    const startedAt = new Date();
    const endsAt =
      effectiveStatus === "TRIAL"
        ? trialEndsAt
        : addYears(startedAt, 1);
    await db.orgSubscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: effectiveStatus === "ACTIVE" ? "ACTIVE" : "TRIAL",
        startedAt,
        endsAt: endsAt || undefined,
        renewsAt: endsAt || undefined,
      },
    });
  }

  if (input.logo && input.logo.size > 0) {
    const logoPath = await storeOrganizationLogo(org.id, input.logo);
    await db.organization.update({
      where: { id: org.id },
      data: { logoPath },
    });
  }

  await seedOrganizationDefaults(db, org.id);
  await writeAudit({
    organizationId: org.id,
    userId: session.user.id,
    action: "admin.org.create",
    entity: "Organization",
    entityId: org.id,
    meta: { plan: plan?.key, status, slug, hasLogo: Boolean(input.logo?.size) },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orgs");
  revalidatePath(`/portal/${org.slug}`);
  return { id: org.id, slug: org.slug, name: org.name };
}

export async function updateOrganizationLogo(orgId: string, logo: File) {
  const session = await requireSuperAdmin();
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error("Organization not found");

  const logoPath = await storeOrganizationLogo(org.id, logo);
  await db.organization.update({
    where: { id: org.id },
    data: { logoPath },
  });

  await writeAudit({
    organizationId: org.id,
    userId: session.user.id,
    action: "admin.org.logo",
    entity: "Organization",
    entityId: org.id,
  });

  revalidatePath("/admin/orgs");
  revalidatePath(`/admin/orgs/${org.id}`);
  revalidatePath(`/portal/${org.slug}`);
  return { logoPath };
}

export async function setOrganizationStatus(orgId: string, status: TenantStatus) {
  const session = await requireSuperAdmin();
  await db.organization.update({
    where: { id: orgId },
    data: { status },
  });
  await writeAudit({
    organizationId: orgId,
    userId: session.user.id,
    action: "admin.org.status",
    entity: "Organization",
    entityId: orgId,
    meta: { status },
  });
  revalidatePath("/admin/orgs");
  revalidatePath(`/admin/orgs/${orgId}`);
}

/** Permanently delete a tenant and cascaded data. Requires typing the org slug. */
export async function deleteOrganization(orgId: string, confirmSlug: string) {
  const session = await requireSuperAdmin();
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, slug: true },
  });
  if (!org) throw new Error("Organization not found");

  const expected = org.slug.trim().toLowerCase();
  if (confirmSlug.trim().toLowerCase() !== expected) {
    throw new Error(`Type the slug "${org.slug}" to confirm deletion.`);
  }

  const users = await db.user.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  await db.$transaction(async (tx) => {
    // Clear audit rows that would block user cascade (no onDelete on AuditLog.userId)
    if (userIds.length) {
      await tx.auditLog.deleteMany({
        where: { userId: { in: userIds } },
      });
    }
    await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
    await tx.organization.delete({ where: { id: orgId } });
  });

  await writeAudit({
    organizationId: null,
    userId: session.user.id,
    action: "admin.org.deleted",
    entity: "Organization",
    entityId: orgId,
    meta: { name: org.name, slug: org.slug },
  });

  revalidatePath("/admin/orgs");
  revalidatePath("/admin");
  revalidatePath(`/admin/orgs/${orgId}`);
}


export async function setOrganizationPlan(orgId: string, planId: string) {
  const session = await requireSuperAdmin();
  const plan = await db.saaSPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error("Plan not found");

  const startedAt = new Date();
  const isTrial = Boolean(plan.trialDays && plan.trialDays > 0);
  const endsAt = isTrial
    ? addDays(startedAt, plan.trialDays!)
    : addYears(startedAt, 1);
  const status = isTrial ? "TRIAL" : "ACTIVE";

  await db.organization.update({
    where: { id: orgId },
    data: {
      planId,
      status,
      trialEndsAt: isTrial ? endsAt : null,
    },
  });
  await db.orgSubscription.create({
    data: {
      organizationId: orgId,
      planId,
      status: isTrial ? "TRIAL" : "ACTIVE",
      startedAt,
      endsAt,
      renewsAt: endsAt,
    },
  });
  await writeAudit({
    organizationId: orgId,
    userId: session.user.id,
    action: "admin.org.plan",
    entity: "Organization",
    entityId: orgId,
    meta: { planId, planKey: plan.key, startedAt, endsAt, status },
  });
  revalidatePath("/admin/orgs");
  revalidatePath(`/admin/orgs/${orgId}`);
}

function revalidateOrg(orgId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/orgs");
  revalidatePath(`/admin/orgs/${orgId}`);
}

export async function updateSubscriptionPeriod(
  orgId: string,
  data: { startedAt: string; endsAt: string }
) {
  const session = await requireSuperAdmin();
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!org) throw new Error("Organization not found");

  const startedAt = new Date(data.startedAt);
  const endsAt = new Date(data.endsAt);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error("Invalid dates");
  }
  if (endsAt <= startedAt) throw new Error("Expiry must be after start");

  const current = org.subscriptions[0];
  if (current) {
    await db.orgSubscription.update({
      where: { id: current.id },
      data: { startedAt, endsAt, renewsAt: endsAt },
    });
  } else if (org.planId) {
    await db.orgSubscription.create({
      data: {
        organizationId: orgId,
        planId: org.planId,
        status: org.status === "TRIAL" ? "TRIAL" : "ACTIVE",
        startedAt,
        endsAt,
        renewsAt: endsAt,
      },
    });
  } else {
    throw new Error("Assign a plan before setting period");
  }

  if (org.status === "TRIAL") {
    await db.organization.update({
      where: { id: orgId },
      data: { trialEndsAt: endsAt },
    });
  }

  await writeAudit({
    organizationId: orgId,
    userId: session.user.id,
    action: "admin.org.period",
    entity: "Organization",
    entityId: orgId,
    meta: { startedAt, endsAt },
  });
  revalidateOrg(orgId);
  return { startedAt, endsAt };
}

async function nextInvoiceNumber(orgId: string, year: number) {
  const count = await db.platformInvoice.count({
    where: { organizationId: orgId, year },
  });
  return `INV-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function createRenewalInvoice(
  orgId: string,
  input?: { year?: number; billingEmail?: string; notes?: string }
) {
  const session = await requireSuperAdmin();
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      plan: true,
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      users: {
        where: { role: "ORG_ADMIN", active: true },
        select: { email: true },
        take: 1,
      },
    },
  });
  if (!org) throw new Error("Organization not found");
  if (!org.plan) throw new Error("Assign a plan first");

  const current = org.subscriptions[0];
  const periodStart = current?.endsAt
    ? new Date(current.endsAt)
    : current?.renewsAt
      ? new Date(current.renewsAt)
      : addYears(new Date(), 0);
  const periodEnd = addYears(periodStart, 1);
  const year = input?.year || periodStart.getFullYear();
  // Annual = 12 × monthly
  const amount = Number(org.plan.priceMonthly) * 12;
  const billingEmail =
    input?.billingEmail?.trim() ||
    org.users[0]?.email ||
    null;

  const number = await nextInvoiceNumber(orgId, year);
  const invoice = await db.platformInvoice.create({
    data: {
      organizationId: orgId,
      subscriptionId: current?.id,
      number,
      year,
      amount,
      status: "DRAFT",
      periodStart,
      periodEnd,
      dueAt: periodStart,
      billingEmail,
      notes: input?.notes?.trim() || `Annual renewal for ${year}`,
    },
  });

  await writeAudit({
    organizationId: orgId,
    userId: session.user.id,
    action: "admin.invoice.create",
    entity: "PlatformInvoice",
    entityId: invoice.id,
    meta: { number, year, amount },
  });

  revalidateOrg(orgId);
  return {
    id: invoice.id,
    number: invoice.number,
    amount,
    year,
  };
}

async function logBillingEvent(params: {
  invoiceId: string;
  type: PlatformBillingEventType;
  toEmail?: string | null;
  subject?: string;
  body?: string;
  mode?: string;
  createdById?: string;
}) {
  return db.platformBillingEvent.create({
    data: {
      invoiceId: params.invoiceId,
      type: params.type,
      toEmail: params.toEmail || undefined,
      subject: params.subject,
      body: params.body,
      mode: params.mode,
      createdById: params.createdById,
    },
  });
}

function invoiceEmailBody(opts: {
  orgName: string;
  number: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  kind: "invoice" | "reminder" | "follow_up";
  extraNote?: string;
}) {
  const period = `${format(opts.periodStart, "dd MMM yyyy")} – ${format(
    opts.periodEnd,
    "dd MMM yyyy"
  )}`;
  const intro =
    opts.kind === "invoice"
      ? `Please find your renewal invoice from ${PLATFORM_NAME}.`
      : opts.kind === "reminder"
        ? `Friendly reminder: your renewal invoice from ${PLATFORM_NAME} is awaiting payment.`
        : `Following up on your outstanding renewal invoice from ${PLATFORM_NAME}.`;

  return [
    `Hello ${opts.orgName} team,`,
    "",
    intro,
    "",
    `Invoice: ${opts.number}`,
    `Amount: ${formatPlatformCurrency(opts.amount)}`,
    `Period: ${period}`,
    opts.extraNote ? `\nNote: ${opts.extraNote}` : "",
    "",
    "Reply to this email if you have questions.",
    "",
    `— ${PLATFORM_NAME} Billing`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function sendPlatformInvoiceEmail(invoiceId: string) {
  const session = await requireSuperAdmin();
  const invoice = await db.platformInvoice.findUnique({
    where: { id: invoiceId },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (!invoice.billingEmail) throw new Error("Set a billing email first");

  const subject = `${PLATFORM_NAME} invoice ${invoice.number} — ${invoice.organization.name}`;
  const body = invoiceEmailBody({
    orgName: invoice.organization.name,
    number: invoice.number,
    amount: Number(invoice.amount),
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    kind: "invoice",
    extraNote: invoice.notes || undefined,
  });

  const result = await sendPlatformEmail(invoice.billingEmail, subject, body);
  if (!result.ok) throw new Error(result.error || "Email failed");

  await db.platformInvoice.update({
    where: { id: invoiceId },
    data: {
      status: invoice.status === "PAID" ? "PAID" : "SENT",
      sentAt: invoice.sentAt || new Date(),
    },
  });

  await logBillingEvent({
    invoiceId,
    type: "INVOICE_SENT",
    toEmail: invoice.billingEmail,
    subject,
    body,
    mode: result.mode,
    createdById: session.user.id,
  });

  await writeAudit({
    organizationId: invoice.organizationId,
    userId: session.user.id,
    action: "admin.invoice.send",
    entity: "PlatformInvoice",
    entityId: invoiceId,
    meta: { mode: result.mode, to: invoice.billingEmail },
  });

  revalidateOrg(invoice.organizationId);
  return { mode: result.mode };
}

export async function sendPlatformInvoiceReminder(
  invoiceId: string,
  note?: string
) {
  const session = await requireSuperAdmin();
  const invoice = await db.platformInvoice.findUnique({
    where: { id: invoiceId },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "PAID") throw new Error("Invoice already paid");
  if (!invoice.billingEmail) throw new Error("Set a billing email first");

  const subject = `Reminder: ${PLATFORM_NAME} invoice ${invoice.number}`;
  const body = invoiceEmailBody({
    orgName: invoice.organization.name,
    number: invoice.number,
    amount: Number(invoice.amount),
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    kind: "reminder",
    extraNote: note?.trim() || invoice.notes || undefined,
  });

  const result = await sendPlatformEmail(invoice.billingEmail, subject, body);
  if (!result.ok) throw new Error(result.error || "Email failed");

  if (invoice.status === "DRAFT") {
    await db.platformInvoice.update({
      where: { id: invoiceId },
      data: { status: "SENT", sentAt: invoice.sentAt || new Date() },
    });
  }

  await logBillingEvent({
    invoiceId,
    type: "REMINDER",
    toEmail: invoice.billingEmail,
    subject,
    body,
    mode: result.mode,
    createdById: session.user.id,
  });

  revalidateOrg(invoice.organizationId);
  return { mode: result.mode };
}

export async function sendPlatformInvoiceFollowUp(
  invoiceId: string,
  note?: string
) {
  const session = await requireSuperAdmin();
  const invoice = await db.platformInvoice.findUnique({
    where: { id: invoiceId },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "PAID") throw new Error("Invoice already paid");
  if (!invoice.billingEmail) throw new Error("Set a billing email first");

  const subject = `Follow-up: ${PLATFORM_NAME} invoice ${invoice.number}`;
  const body = invoiceEmailBody({
    orgName: invoice.organization.name,
    number: invoice.number,
    amount: Number(invoice.amount),
    periodStart: invoice.periodStart,
    periodEnd: invoice.periodEnd,
    kind: "follow_up",
    extraNote:
      note?.trim() ||
      "Please confirm payment timeline so we can keep your workspace active.",
  });

  const result = await sendPlatformEmail(invoice.billingEmail, subject, body);
  if (!result.ok) throw new Error(result.error || "Email failed");

  await logBillingEvent({
    invoiceId,
    type: "FOLLOW_UP",
    toEmail: invoice.billingEmail,
    subject,
    body,
    mode: result.mode,
    createdById: session.user.id,
  });

  revalidateOrg(invoice.organizationId);
  return { mode: result.mode };
}

export async function markPlatformInvoicePaid(invoiceId: string) {
  const session = await requireSuperAdmin();
  const { activatePaidPlatformInvoice } = await import("@/lib/saas-billing");
  const invoice = await activatePaidPlatformInvoice(db, invoiceId, {
    mode: "admin",
    createdById: session.user.id,
  });

  await writeAudit({
    organizationId: invoice.organizationId,
    userId: session.user.id,
    action: "admin.invoice.paid",
    entity: "PlatformInvoice",
    entityId: invoiceId,
  });

  revalidateOrg(invoice.organizationId);
}

export async function updateInvoiceBillingEmail(
  invoiceId: string,
  billingEmail: string
) {
  await requireSuperAdmin();
  const email = billingEmail.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Valid email required");
  const invoice = await db.platformInvoice.update({
    where: { id: invoiceId },
    data: { billingEmail: email },
  });
  revalidateOrg(invoice.organizationId);
}

export async function updateSaaSPlan(
  planId: string,
  data: {
    name?: string;
    priceMonthly?: number;
    description?: string;
    maxUsers?: number;
    maxTicketsPerMonth?: number;
    trialDays?: number | null;
    active?: boolean;
    features?: string[];
  }
) {
  await requireSuperAdmin();
  await db.saaSPlan.update({
    where: { id: planId },
    data: {
      name: data.name,
      priceMonthly: data.priceMonthly,
      description: data.description,
      maxUsers: data.maxUsers,
      maxTicketsPerMonth: data.maxTicketsPerMonth,
      trialDays: data.trialDays,
      active: data.active,
      features: data.features,
    },
  });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  revalidatePath("/admin");
}

function revalidateWebsite() {
  revalidatePath("/admin/website");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/pricing");
  revalidatePath("/features");
  revalidatePath("/about");
  revalidatePath("/contact");
}

export async function updateWebsiteSettings(data: {
  brandName: string;
  heroBadge: string;
  heroHeadline: string;
  heroSubtext: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  heroStats: { value: string; label: string }[];
  newsTickerItems: string[];
  featuresTitle: string;
  featuresSubtitle: string;
  sectionTitle: string;
  sectionBody: string;
  midTitle: string;
  midBody: string;
  analysisTitle: string;
  analysisBody: string;
  analysisBullets: string[];
  integrationsTitle: string;
  integrationsBody: string;
  integrations: string[];
  ctaTitle: string;
  ctaBody: string;
  contactEmail: string;
  contactPhone: string;
  footerBlurb: string;
  footerNote: string;
  copyrightName: string;
  seoPages: {
    home: { title: string; description: string; keywords: string };
    about: { title: string; description: string; keywords: string };
    features: { title: string; description: string; keywords: string };
    pricing: { title: string; description: string; keywords: string };
    contact: { title: string; description: string; keywords: string };
  };
}) {
  await requireSuperAdmin();
  const brandName = data.brandName.trim() || "SaleDek";
  const heroStats = data.heroStats
    .map((s) => ({
      value: String(s.value || "").trim(),
      label: String(s.label || "").trim(),
    }))
    .filter((s) => s.value && s.label)
    .slice(0, 6);
  const newsTickerItems = data.newsTickerItems
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);
  const analysisBullets = data.analysisBullets
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const integrations = data.integrations
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 16);

  const seoPages = {
    home: {
      title: data.seoPages.home.title.trim(),
      description: data.seoPages.home.description.trim(),
      keywords: data.seoPages.home.keywords.trim(),
    },
    about: {
      title: data.seoPages.about.title.trim(),
      description: data.seoPages.about.description.trim(),
      keywords: data.seoPages.about.keywords.trim(),
    },
    features: {
      title: data.seoPages.features.title.trim(),
      description: data.seoPages.features.description.trim(),
      keywords: data.seoPages.features.keywords.trim(),
    },
    pricing: {
      title: data.seoPages.pricing.title.trim(),
      description: data.seoPages.pricing.description.trim(),
      keywords: data.seoPages.pricing.keywords.trim(),
    },
    contact: {
      title: data.seoPages.contact.title.trim(),
      description: data.seoPages.contact.description.trim(),
      keywords: data.seoPages.contact.keywords.trim(),
    },
  };

  const payload = {
    brandName,
    heroBadge: data.heroBadge.trim() || "CRM & SaaS",
    heroHeadline: data.heroHeadline.trim(),
    heroSubtext: data.heroSubtext.trim(),
    heroCtaLabel: data.heroCtaLabel.trim(),
    heroCtaHref: data.heroCtaHref.trim() || "/register",
    heroSecondaryLabel: data.heroSecondaryLabel.trim(),
    heroSecondaryHref: data.heroSecondaryHref.trim() || "/pricing",
    heroStats,
    newsTickerItems,
    featuresTitle: data.featuresTitle.trim(),
    featuresSubtitle: data.featuresSubtitle.trim(),
    sectionTitle: data.sectionTitle.trim(),
    sectionBody: data.sectionBody.trim(),
    midTitle: data.midTitle.trim(),
    midBody: data.midBody.trim(),
    analysisTitle: data.analysisTitle.trim(),
    analysisBody: data.analysisBody.trim(),
    analysisBullets,
    integrationsTitle: data.integrationsTitle.trim(),
    integrationsBody: data.integrationsBody.trim(),
    integrations,
    ctaTitle: data.ctaTitle.trim(),
    ctaBody: data.ctaBody.trim(),
    contactEmail: data.contactEmail.trim() || "info@yourmail.com",
    contactPhone: data.contactPhone.trim() || "(00) 99 222 99566",
    footerBlurb: data.footerBlurb.trim(),
    footerNote: data.footerNote.trim(),
    copyrightName: data.copyrightName.trim() || brandName,
    seoPages,
  };

  try {
    await db.platformWebsiteSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...payload },
      update: payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/seoPages|Unknown column/i.test(message)) {
      await db.$executeRawUnsafe(
        "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `seoPages` JSON NOT NULL DEFAULT ('{}')",
      );
      await db.platformWebsiteSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...payload },
        update: payload,
      });
    } else {
      throw err;
    }
  }
  revalidateWebsite();
}

export async function updateWebsiteLogo(logo: File) {
  await requireSuperAdmin();
  const { storePlatformLogo } = await import("@/lib/platform-logo-server");
  const stored = await storePlatformLogo(logo);
  const data = {
    logoPath: stored.logoPath,
    logoData: stored.logoData,
    logoMime: stored.logoMime,
  };
  try {
    await db.platformWebsiteSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/logoData|logoMime|Unknown column/i.test(message)) {
      await db.$executeRawUnsafe(
        "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `logoData` LONGTEXT NULL",
      );
      await db.$executeRawUnsafe(
        "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `logoMime` VARCHAR(191) NULL",
      );
      await db.platformWebsiteSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...data },
        update: data,
      });
    } else {
      throw err;
    }
  }
  revalidateWebsite();
  return { logoPath: stored.logoPath };
}

export async function clearWebsiteLogo() {
  await requireSuperAdmin();
  await db.platformWebsiteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", logoPath: null, logoData: null, logoMime: null },
    update: { logoPath: null, logoData: null, logoMime: null },
  });
  revalidateWebsite();
}

async function ensureFaviconColumns() {
  for (const sql of [
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconPath` VARCHAR(191) NULL",
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconData` LONGTEXT NULL",
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconMime` VARCHAR(191) NULL",
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

export async function updateWebsiteFavicon(favicon: File) {
  await requireSuperAdmin();
  const { storePlatformFavicon } = await import("@/lib/platform-logo-server");
  const stored = await storePlatformFavicon(favicon);
  const data = {
    faviconPath: stored.faviconPath,
    faviconData: stored.faviconData,
    faviconMime: stored.faviconMime,
  };
  try {
    await db.platformWebsiteSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...data },
      update: data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/faviconPath|faviconData|faviconMime|Unknown column/i.test(message)) {
      await ensureFaviconColumns();
      await db.platformWebsiteSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...data },
        update: data,
      });
    } else {
      throw err;
    }
  }
  revalidateWebsite();
  return { faviconPath: stored.faviconPath };
}

export async function clearWebsiteFavicon() {
  await requireSuperAdmin();
  try {
    await db.platformWebsiteSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        faviconPath: null,
        faviconData: null,
        faviconMime: null,
      },
      update: { faviconPath: null, faviconData: null, faviconMime: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/faviconPath|faviconData|faviconMime|Unknown column/i.test(message)) {
      await ensureFaviconColumns();
      await db.platformWebsiteSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          faviconPath: null,
          faviconData: null,
          faviconMime: null,
        },
        update: { faviconPath: null, faviconData: null, faviconMime: null },
      });
    } else {
      throw err;
    }
  }
  revalidateWebsite();
}

function revalidateSuperUsers() {
  revalidatePath("/admin/superusers");
  revalidatePath("/admin");
}

async function getSuperAdminOrThrow(userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, role: "SUPER_ADMIN", organizationId: null },
  });
  if (!user) throw new Error("Superuser not found");
  return user;
}

export async function createSuperAdmin(input: {
  name: string;
  email: string;
  password: string;
}) {
  const session = await requireSuperAdmin();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name || !email || !email.includes("@")) {
    throw new Error("Name and valid email are required");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      organizationId: null,
      active: true,
    },
  });

  await writeAudit({
    userId: session.user.id,
    action: "admin.superuser.create",
    entity: "User",
    entityId: user.id,
    meta: { email },
  });

  revalidateSuperUsers();
  return { id: user.id, email: user.email, name: user.name };
}

export async function updateSuperAdmin(input: {
  userId: string;
  name: string;
  email: string;
  active: boolean;
}) {
  const session = await requireSuperAdmin();
  const existing = await getSuperAdminOrThrow(input.userId);
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name || !email || !email.includes("@")) {
    throw new Error("Name and valid email are required");
  }

  if (existing.id === session.user.id && !input.active) {
    throw new Error("You cannot deactivate your own account");
  }

  if (!input.active) {
    const activeCount = await db.user.count({
      where: { role: "SUPER_ADMIN", organizationId: null, active: true },
    });
    if (activeCount <= 1 && existing.active) {
      throw new Error("Keep at least one active superuser");
    }
  }

  if (email !== existing.email) {
    const taken = await db.user.findUnique({ where: { email } });
    if (taken) throw new Error("Email already registered");
  }

  const user = await db.user.update({
    where: { id: existing.id },
    data: { name, email, active: input.active },
  });

  await writeAudit({
    userId: session.user.id,
    action: "admin.superuser.update",
    entity: "User",
    entityId: user.id,
    meta: { email: user.email, active: user.active },
  });

  revalidateSuperUsers();
  return { id: user.id, email: user.email, name: user.name, active: user.active };
}

export async function resetSuperAdminPassword(input: {
  userId: string;
  password: string;
}) {
  const session = await requireSuperAdmin();
  const existing = await getSuperAdminOrThrow(input.userId);

  if (input.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  await db.user.update({
    where: { id: existing.id },
    data: { passwordHash },
  });

  await writeAudit({
    userId: session.user.id,
    action: "admin.superuser.password_reset",
    entity: "User",
    entityId: existing.id,
    meta: { email: existing.email },
  });

  revalidateSuperUsers();
  return { id: existing.id };
}

export type { SaaSPlanKey, SubscriptionStatus };
