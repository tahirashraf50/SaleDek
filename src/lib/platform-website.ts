import { db } from "@/lib/db";

export const PLATFORM_LOGO_PUBLIC_URL = "/api/platform-logo";

export type HeroStat = { value: string; label: string };

export type WebsiteSettings = Awaited<ReturnType<typeof getWebsiteSettings>>;

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

export async function getWebsiteSettings() {
  const row = await db.platformWebsiteSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return {
    ...row,
    logoUrl: row.logoPath
      ? `${PLATFORM_LOGO_PUBLIC_URL}?v=${encodeURIComponent(row.updatedAt.toISOString())}`
      : null,
    heroStats: asHeroStats(row.heroStats, DEFAULT_STATS),
    newsTickerItems: asStringArray(row.newsTickerItems, DEFAULT_TICKER),
    analysisBullets: asStringArray(row.analysisBullets, DEFAULT_BULLETS),
    integrations: asStringArray(row.integrations, DEFAULT_INTEGRATIONS),
  };
}
