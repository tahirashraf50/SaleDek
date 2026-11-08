export type SeoPageKey = "home" | "about" | "features" | "pricing" | "contact";

export type PageSeo = {
  title: string;
  description: string;
  keywords: string;
};

export type SeoPages = Record<SeoPageKey, PageSeo>;

export const SEO_PAGE_META: {
  key: SeoPageKey;
  label: string;
  path: string;
}[] = [
  { key: "home", label: "Home", path: "/" },
  { key: "about", label: "About Us", path: "/about" },
  { key: "features", label: "Features", path: "/features" },
  { key: "pricing", label: "Pricing", path: "/pricing" },
  { key: "contact", label: "Contact", path: "/contact" },
];

export const DEFAULT_SEO_PAGES: SeoPages = {
  home: {
    title: "SaleDek — CRM & Sales Platform",
    description:
      "All-in-one CRM to capture leads, manage customers, track sales, automate follow-ups, and close more deals.",
    keywords: "CRM, sales CRM, SaleDek, lead management, customer management, sales pipeline",
  },
  about: {
    title: "About Us — SaleDek",
    description:
      "Learn how SaleDek helps teams combine CRM, sales pipelines, tickets, and payments in one multi-tenant workspace.",
    keywords: "about SaleDek, CRM company, sales software, multi-tenant CRM",
  },
  features: {
    title: "Features — SaleDek CRM",
    description:
      "Explore SaleDek features: contact management, sales automation, inbox, tickets, analytics, portal, and shop.",
    keywords: "CRM features, sales automation, ticket system, WhatsApp inbox, analytics",
  },
  pricing: {
    title: "Pricing — SaleDek SaaS Plans",
    description:
      "Simple SaleDek packages for every team size. Start with a free demo, then choose Starter, Pro, or Enterprise.",
    keywords: "CRM pricing, SaleDek plans, SaaS pricing, free CRM demo",
  },
  contact: {
    title: "Contact — SaleDek",
    description:
      "Get in touch with the SaleDek team for demos, onboarding, and support.",
    keywords: "contact SaleDek, CRM support, sales demo request",
  },
};

export function asSeoPages(value: unknown): SeoPages {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const out = { ...DEFAULT_SEO_PAGES };
  for (const { key } of SEO_PAGE_META) {
    const row = raw[key];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    out[key] = {
      title: String(r.title ?? "").trim() || DEFAULT_SEO_PAGES[key].title,
      description:
        String(r.description ?? "").trim() || DEFAULT_SEO_PAGES[key].description,
      keywords: String(r.keywords ?? "").trim() || DEFAULT_SEO_PAGES[key].keywords,
    };
  }
  return out;
}
