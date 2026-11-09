import type { Metadata } from "next";
import { db } from "@/lib/db";
import {
  asSeoPages,
  DEFAULT_SEO_PAGES,
  type SeoPageKey,
  type SeoPages,
} from "@/lib/website-seo";

export {
  SEO_PAGE_META,
  DEFAULT_SEO_PAGES,
  asSeoPages,
  type SeoPageKey,
  type PageSeo,
  type SeoPages,
} from "@/lib/website-seo";

export const PLATFORM_LOGO_PUBLIC_URL = "/api/platform-logo";
export const PLATFORM_FAVICON_PUBLIC_URL = "/api/platform-favicon";

export type HeroStat = { value: string; label: string };

export type WebsiteSettings = {
  brandName: string;
  logoUrl: string | null;
  logoPath: string | null;
  faviconUrl: string | null;
  faviconPath: string | null;
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
  seoPages: SeoPages;
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
  faviconUrl: null,
  faviconPath: null,
  heroBadge: "CRM & SaaS",
  heroHeadline: "Everything You Need to Grow Your Sales",
  heroSubtext:
    "The all-in-one CRM platform to capture leads, manage customers, track sales, automate follow-ups, and close more deals.",
  heroCtaLabel: "Get Demo",
  heroCtaHref: "/register?plan=DEMO",
  heroSecondaryLabel: "View Demo",
  heroSecondaryHref: "/pricing",
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
  seoPages: DEFAULT_SEO_PAGES,
};

function mapRow(row: {
  brandName: string;
  logoPath: string | null;
  faviconPath?: string | null;
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
  logoData?: string | null;
  faviconData?: string | null;
  seoPages?: unknown;
  updatedAt: Date;
}): WebsiteSettings {
  const brandName =
    !row.brandName || row.brandName === "PulseCRM" ? "SaleDek" : row.brandName;
  const copyrightName =
    !row.copyrightName || row.copyrightName === "PulseCRM"
      ? "SaleDek"
      : row.copyrightName;
  const hasLogo = Boolean(row.logoData || row.logoPath);
  const hasFavicon = Boolean(row.faviconData || row.faviconPath);
  const cacheBust = encodeURIComponent(row.updatedAt.toISOString());
  const scrub = (s: string) => s.replaceAll("PulseCRM", "SaleDek");
  return {
    brandName,
    logoPath: row.logoPath,
    logoUrl: hasLogo ? `${PLATFORM_LOGO_PUBLIC_URL}?v=${cacheBust}` : null,
    faviconPath: row.faviconPath ?? null,
    faviconUrl: hasFavicon
      ? `${PLATFORM_FAVICON_PUBLIC_URL}?v=${cacheBust}`
      : null,
    heroBadge: scrub(row.heroBadge),
    heroHeadline: scrub(row.heroHeadline),
    heroSubtext: scrub(row.heroSubtext),
    heroCtaLabel: row.heroCtaLabel,
    heroCtaHref: row.heroCtaHref,
    heroSecondaryLabel: row.heroSecondaryLabel,
    heroSecondaryHref: row.heroSecondaryHref,
    heroStats: asHeroStats(row.heroStats, DEFAULT_STATS),
    newsTickerItems: asStringArray(row.newsTickerItems, DEFAULT_TICKER),
    featuresTitle: scrub(row.featuresTitle),
    featuresSubtitle: scrub(row.featuresSubtitle),
    sectionTitle: scrub(row.sectionTitle),
    sectionBody: scrub(row.sectionBody),
    midTitle: scrub(row.midTitle),
    midBody: scrub(row.midBody),
    analysisTitle: scrub(row.analysisTitle),
    analysisBody: scrub(row.analysisBody),
    analysisBullets: asStringArray(row.analysisBullets, DEFAULT_BULLETS).map(scrub),
    integrations: asStringArray(row.integrations, DEFAULT_INTEGRATIONS),
    integrationsTitle: scrub(row.integrationsTitle),
    integrationsBody: scrub(row.integrationsBody),
    ctaTitle: scrub(row.ctaTitle),
    ctaBody: scrub(row.ctaBody),
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    footerBlurb: scrub(row.footerBlurb),
    footerNote: scrub(row.footerNote),
    copyrightName,
    seoPages: asSeoPages(row.seoPages),
  };
}

async function ensureWebsiteColumns() {
  const alters = [
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `seoPages` JSON NOT NULL DEFAULT ('{}')",
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `logoData` LONGTEXT NULL",
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `logoMime` VARCHAR(191) NULL",
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconPath` VARCHAR(191) NULL",
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconData` LONGTEXT NULL",
    "ALTER TABLE `PlatformWebsiteSettings` ADD COLUMN `faviconMime` VARCHAR(191) NULL",
  ];
  for (const sql of alters) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/Duplicate column|already exists/i.test(message)) {
        // ignore — table may be missing (fallback path)
      }
    }
  }
}

export async function getWebsiteSettings(): Promise<WebsiteSettings> {
  try {
    const row = await db.platformWebsiteSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        brandName: "SaleDek",
        copyrightName: "SaleDek",
        seoPages: DEFAULT_SEO_PAGES,
      },
      update: {},
    });
    // One-time rename leftover PulseCRM defaults in DB
    if (row.brandName === "PulseCRM" || row.copyrightName === "PulseCRM") {
      await db.platformWebsiteSettings.update({
        where: { id: "default" },
        data: {
          brandName: row.brandName === "PulseCRM" ? "SaleDek" : row.brandName,
          copyrightName:
            row.copyrightName === "PulseCRM" ? "SaleDek" : row.copyrightName,
        },
      });
    }
    return mapRow(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      /seoPages|logoData|logoMime|faviconPath|faviconData|faviconMime|Unknown column/i.test(
        message,
      )
    ) {
      await ensureWebsiteColumns();
      try {
        const row = await db.platformWebsiteSettings.upsert({
          where: { id: "default" },
          create: { id: "default", seoPages: DEFAULT_SEO_PAGES },
          update: {},
        });
        return mapRow(row);
      } catch (retryErr) {
        console.error("[getWebsiteSettings] retry failed:", retryErr);
      }
    }
    console.error("[getWebsiteSettings] DB unavailable, using fallback:", err);
    return FALLBACK;
  }
}

export async function buildMarketingMetadata(page: SeoPageKey): Promise<Metadata> {
  const site = await getWebsiteSettings();
  const seo = site.seoPages[page];
  const keywords = seo.keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    title: seo.title,
    description: seo.description,
    keywords: keywords.length ? keywords : undefined,
    icons: site.faviconUrl
      ? {
          icon: [
            { url: site.faviconUrl, type: "image/png" },
            { url: site.faviconUrl },
          ],
          shortcut: site.faviconUrl,
          apple: site.faviconUrl,
        }
      : undefined,
    openGraph: {
      title: seo.title,
      description: seo.description,
      siteName: site.brandName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
    },
  };
}
