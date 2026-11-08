import Link from "next/link";
import {
  buildMarketingMetadata,
  getWebsiteSettings,
} from "@/lib/platform-website";

export async function generateMetadata() {
  return buildMarketingMetadata("about");
}

export default async function AboutPage() {
  const site = await getWebsiteSettings();

  return (
    <div className="site-hero-glow pt-28 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <span className="site-pill">About Us</span>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-[var(--site-ink)] md:text-6xl">
          The only business management tool that combines CRM, projects, and payments
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--site-muted)] md:text-lg">
          {site.brandName} helps startups and growing teams manage contacts, automate sales,
          track work, and close deals — with the same clean Saafiy-style experience your
          customers expect from a modern SaaS CRM.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              t: "Built for operators",
              d: "Inbox, tickets, sales pipelines, and billing in one tenant workspace.",
            },
            {
              t: "Multi-tenant ready",
              d: "Every company you onboard gets isolated data, shop, and customer portal.",
            },
            {
              t: "Demo in minutes",
              d: "Start with a free 15-day Demo plan and invite your team immediately.",
            },
          ].map((card) => (
            <div key={card.t} className="site-feature-card">
              <h2 className="text-xl font-semibold text-[var(--site-ink)]">{card.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">{card.d}</p>
            </div>
          ))}
        </div>
        <Link href="/register?plan=DEMO" className="site-btn-primary mt-10 inline-flex">
          Get Demo
        </Link>
      </div>
    </div>
  );
}
