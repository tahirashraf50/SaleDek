import { db } from "@/lib/db";

export const PLATFORM_LOGO_PUBLIC_URL = "/api/platform-logo";

export type HeroStat = { value: string; label: string };

export type WebsiteSettings = {
  brandName: string;
  logoUrl: string | null;
  logoPath: string | null;
  heroBadge: string;
  heroHeadline: string;
  heroSubtext: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  heroStats: HeroStat[];
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
  integrations: string[];
  integrationsTitle: string;
  integrationsBody: string;
  ctaTitle: string;
  ctaBody: string;
  contactEmail: string;
  contactPhone: string;
  footerBlurb: string;
  footerNote: string;
  copyrightName: string;
};

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function asHeroStats(value: unknown, fallback: HeroStat[]): HeroStat[] {
  if (!Array.isArray(value)) return fallback;
  const parsed = value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const v = String(r.value ?? "").trim();
      const l = String(r.label ?? "").trim();
      if (!v || !l) return null;
      return { value: v, label: l };
    })
    .filter(Boolean) as HeroStat[];
  return parsed.length ? parsed : fallback;
}

const DEFAULT_STATS: HeroStat[] = [
  { value: "15d", label: "Free demo" },
  { value: "6+", label: "Core modules" },
  { value: "24/7", label: "Inbox ready" },
];

const DEFAULT_TICKER = [
  "WhatsApp Inbox",
  "Sales Pipelines",
  "Ticket SLA",
  "JazzCash Payments",
  "Customer Portal",
  "Tenant Shop",
  "Analytics",
  "Automations",
];

const DEFAULT_BULLETS = [
  "Automated renewal tracking and reminders",
  "Powerful filters and search to access information quickly",
  "Folder structure to stay organized",
];

const DEFAULT_INTEGRATIONS = [
  "WhatsApp",
  "Email",
  "JazzCash",
  "Portal",
  "Shop",
  "Slack",
];

const FALLBACK: WebsiteSettings = {
  brandName: "SaleDek",
  logoUrl: null,
  logoPath: null,
  heroBadge: "CRM & SaaS",
  heroHeadline: "Everything You Need to Grow Your Sales",
  heroSubtext:
    "The all-in-one CRM platform to capture leads, manage customers, track sales, automate follow-ups, and close more deals.",
  heroCtaLabel: "Get Demo",
  heroCtaHref: "/register?plan=DEMO",
  heroSecondaryLabel: "View Demo",
  heroSecondaryHref: "/site/pricing",
  heroStats: DEFAULT_STATS,
  newsTickerItems: DEFAULT_TICKER,
  featuresTitle: "Everything your team needs to grow",
  featuresSubtitle:
    "Contact, sales, email, tasks, analytics, and support — one CRM workspace.",
  sectionTitle: "Easily customize all your business reports",
  sectionBody:
    "Keep your team members and customers in the loop by sharing your dashboard publicly or privately and receiving regular reports via email. Access links let your clients view their website.",
  midTitle: "Easily customize all your business reports",
  midBody:
    "Bring your CRM into day-to-day operations — pipelines, collaboration, and deals in one place.",
  analysisTitle: "Speed up your analysis",
  analysisBody:
    "Expand research across your organization with customization, security, and compliance features built with enterprise in mind.",
  analysisBullets: DEFAULT_BULLETS,
  integrations: DEFAULT_INTEGRATIONS,
  integrationsTitle: "Connect with your favourite Apps",
  integrationsBody:
    "Keep your team members and customers in the loop by sharing your dashboard publicly or privately and receiving regular reports via email.",
  ctaTitle: "Ready to see a personalized demo?",
  ctaBody:
    "Pick a plan, create your org, and invite agents. Super admins manage every tenant from one console.",
  contactEmail: "info@saledek.com",
  contactPhone: "(00) 99 222 99566",
  footerBlurb:
    "The only business management tool that combines CRM, time tracking, project management, invoicing and payments.",
  footerNote: "Built for service + sales teams",
  copyrightName: "SaleDek",
};

function mapRow(row: {
  brandName: string;
  logoPath: string | null;
  heroBadge: string;
  heroHeadline: string;
  heroSubtext: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  heroStats: unknown;
  newsTickerItems: unknown;
  featuresTitle: string;
  featuresSubtitle: string;
  sectionTitle: string;
  sectionBody: string;
  midTitle: string;
  midBody: string;
  analysisTitle: string;
  analysisBody: string;
  analysisBullets: unknown;
  integrations: unknown;
  integrationsTitle: string;
  integrationsBody: string;
  ctaTitle: string;
  ctaBody: string;
  contactEmail: string;
  contactPhone: string;
  footerBlurb: string;
  footerNote: string;
  copyrightName: string;
  updatedAt: Date;
}): WebsiteSettings {
  return {
    brandName: row.brandName,
    logoPath: row.logoPath,
    logoUrl: row.logoPath
      ? `${PLATFORM_LOGO_PUBLIC_URL}?v=${encodeURIComponent(row.updatedAt.toISOString())}`
      : null,
    heroBadge: row.heroBadge,
    heroHeadline: row.heroHeadline,
    heroSubtext: row.heroSubtext,
    heroCtaLabel: row.heroCtaLabel,
    heroCtaHref: row.heroCtaHref,
    heroSecondaryLabel: row.heroSecondaryLabel,
    heroSecondaryHref: row.heroSecondaryHref,
    heroStats: asHeroStats(row.heroStats, DEFAULT_STATS),
    newsTickerItems: asStringArray(row.newsTickerItems, DEFAULT_TICKER),
    featuresTitle: row.featuresTitle,
    featuresSubtitle: row.featuresSubtitle,
    sectionTitle: row.sectionTitle,
    sectionBody: row.sectionBody,
    midTitle: row.midTitle,
    midBody: row.midBody,
    analysisTitle: row.analysisTitle,
    analysisBody: row.analysisBody,
    analysisBullets: asStringArray(row.analysisBullets, DEFAULT_BULLETS),
    integrations: asStringArray(row.integrations, DEFAULT_INTEGRATIONS),
    integrationsTitle: row.integrationsTitle,
    integrationsBody: row.integrationsBody,
    ctaTitle: row.ctaTitle,
    ctaBody: row.ctaBody,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    footerBlurb: row.footerBlurb,
    footerNote: row.footerNote,
    copyrightName: row.copyrightName,
  };
}

export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  try {
    const row = await db.platformWebsiteSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    });
    return mapRow(row);
  } catch (err) {
    console.error("[getWebsiteSettings] DB unavailable, using fallback:", err);
    return FALLBACK;
  }
}
