import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  Headphones,
  Mail,
  Phone,
  Sparkles,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import { auth } from "@/lib/auth";
import {
  buildMarketingMetadata,
  getWebsiteSettings,
} from "@/lib/platform-website";
import { HeroShowcase } from "@/components/marketing/hero-showcase";
import { ReportsShowcase } from "@/components/marketing/reports-showcase";

export async function generateMetadata() {
  return buildMarketingMetadata("home");
}

/** Keep hero title on two intentional lines when possible. */
function formatHeroHeadline(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];
  if (trimmed.includes("\n")) {
    return trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  }
  const match = trimmed.match(
    /^(Everything Your Business Needs)\s+(to Serve and Sell\.?)$/i,
  );
  if (match) return [match[1], match[2]];
  return [trimmed];
}

const ANALYSIS_IMG =
  "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/group_1000005169-1-768x656-1.webp";
const DEAL_IMG =
  "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/group_1000005170-768x619-1.webp";
const OPS_IMG =
  "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/05-768x707-1.webp";
const OPS_IMG_2 =
  "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/06-768x707-1.webp";

const FEATURES = [
  {
    title: "Contact Management",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Users,
  },
  {
    title: "Sales Automation",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Workflow,
  },
  {
    title: "Email Integration",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Mail,
  },
  {
    title: "Task and Activity",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Target,
  },
  {
    title: "Reporting and Analytics",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: BarChart3,
  },
  {
    title: "Customer Support",
    body: "Store and manage contact information for leads, prospects, and customers",
    icon: Headphones,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "AI tools today are very complicated and take months to get results. With Obviously AI, we were able to onboard several of our analysts seamlessly.",
    name: "Alonzo Murray",
    role: "CEO, Marvel Inc.",
    avatar:
      "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/01-1.webp",
  },
  {
    quote:
      "AI tools today are very complicated and take months to get results. With Obviously AI, we were able to onboard several of our analysts seamlessly.",
    name: "Josh Carrey",
    role: "Sr, Director",
    avatar:
      "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/02.png",
  },
  {
    quote:
      "AI tools today are very complicated and take months to get results. With Obviously AI, we were able to onboard several of our analysts seamlessly.",
    name: "Jos Buttler",
    role: "Sr, Director",
    avatar:
      "https://themewant.com/products/wordpress/saafiy/crm/wp-content/uploads/sites/2/2024/10/03.png",
  },
];

export default async function SiteHomePage() {
  try {
    const session = await auth();
    if (session?.user) {
      if (session.user.role === "SUPER_ADMIN") redirect("/admin");
      if (session.user.organizationStatus === "SUSPENDED") redirect("/suspended");
      redirect("/inbox");
    }
  } catch (err) {
    console.error("[home] auth check failed, showing marketing:", err);
  }

  const site = await getWebsiteSettings();
  const phoneTel = site.contactPhone.replace(/[^\d+]/g, "") || site.contactPhone;

  return (
    <>
      {/* Hero — Saafiy CRM with themed slider backdrop */}
      <section className="site-hero-glow relative z-0 overflow-hidden pb-16 pt-28 md:pb-20 md:pt-32">
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:px-6">
          <div>
            <span className="site-pill site-anim-fade">
              <Sparkles className="h-3.5 w-3.5" />
              {site.heroBadge}
            </span>
            <h1 className="site-anim-fade site-anim-fade-delay-1 mt-5 text-4xl font-semibold leading-[1.12] tracking-tight text-[var(--site-ink)] md:text-5xl lg:text-[3.75rem]">
              {formatHeroHeadline(site.heroHeadline).map((line, i) => (
                <span key={`${line}-${i}`} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="site-anim-fade site-anim-fade-delay-2 mt-5 max-w-lg text-base leading-relaxed text-[var(--site-muted)] md:text-lg">
              {site.heroSubtext}
            </p>
            <div className="site-anim-fade site-anim-fade-delay-3 mt-8 flex flex-wrap gap-3">
              <Link href={site.heroCtaHref || "/register?plan=DEMO"} className="site-btn-primary">
                {site.heroCtaLabel || "Get Demo"}
              </Link>
              <Link
                href={site.heroSecondaryHref || "/pricing"}
                className="site-btn-lime"
              >
                {site.heroSecondaryLabel || "View Demo"}
              </Link>
            </div>
            <div className="site-anim-fade site-anim-fade-delay-3 mt-8 grid max-w-md grid-cols-3 gap-3">
              {site.heroStats.map((s) => (
                <div key={`${s.value}-${s.label}`} className="site-stat">
                  <p className="text-lg font-semibold text-[var(--site-purple)]">
                    {s.value}
                  </p>
                  <p className="text-[11px] font-medium text-[var(--site-muted)]">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <HeroShowcase />
        </div>
      </section>

      {/* Core Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="site-pill">Core Features</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-5xl">
            {site.featuresTitle}
          </h2>
          <p className="mt-4 text-[var(--site-muted)]">{site.featuresSubtitle}</p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="site-feature-card">
                <span className="site-icon-blob">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-[var(--site-ink)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">
                  {f.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Customize reports */}
      <section className="site-soft-band relative overflow-hidden">
        <div className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-[rgba(172,22,224,0.12)] blur-2xl" />
        <div className="pointer-events-none absolute -right-8 bottom-8 h-48 w-48 rounded-full bg-[rgba(201,255,112,0.25)] blur-2xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:px-6 md:py-28">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-5xl">
              {site.sectionTitle}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--site-muted)]">
              {site.sectionBody}
            </p>
            <Link href="/register?plan=DEMO" className="site-btn-primary mt-8">
              Try for Free
            </Link>
          </div>
          <ReportsShowcase />
        </div>
      </section>

      {/* Speed up analysis */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(circle_at_30%_30%,rgba(201,255,112,0.25),transparent_60%)]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ANALYSIS_IMG}
                alt="Analysis dashboard"
                className="relative mx-auto w-full max-w-md object-contain"
              />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-5xl">
              {site.analysisTitle}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[var(--site-muted)]">
              {site.analysisBody}
            </p>
            <ul className="mt-7 space-y-3">
              {site.analysisBullets.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-[var(--site-ink)]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--site-purple)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Two feature highlights */}
      <section className="site-soft-band">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-5xl">
              {site.midTitle}
            </h2>
            <p className="mt-4 text-[var(--site-muted)]">{site.midBody}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <article className="group overflow-hidden rounded-[1.75rem] border border-[var(--site-line)] bg-white shadow-[0_24px_50px_-36px_rgba(31,31,31,0.4)] transition hover:-translate-y-1 hover:shadow-[0_28px_55px_-30px_rgba(172,22,224,0.35)]">
              <div className="relative h-56 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OPS_IMG}
                  alt=""
                  className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-7">
                <h3 className="text-2xl font-semibold text-[var(--site-ink)]">
                  Bring your CRM to your business operation
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
                  Display and edit CRM data on top of LinkedIn business profiles.
                </p>
              </div>
            </article>
            <article className="group overflow-hidden rounded-[1.75rem] border border-[var(--site-line)] bg-white shadow-[0_24px_50px_-36px_rgba(31,31,31,0.4)] transition hover:-translate-y-1 hover:shadow-[0_28px_55px_-30px_rgba(172,22,224,0.35)]">
              <div className="relative h-56 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={DEAL_IMG}
                  alt=""
                  className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OPS_IMG_2}
                  alt=""
                  className="pointer-events-none absolute -right-6 -bottom-8 hidden w-36 rotate-6 opacity-90 drop-shadow-xl md:block"
                />
              </div>
              <div className="p-7">
                <h3 className="text-2xl font-semibold text-[var(--site-ink)]">
                  Managing deals just got easier
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
                  Create pipelines to match your workflow, collaborate with team members, and
                  close more deals.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <span className="site-pill">Testimonials</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-5xl">
            People are loving to using our software
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <blockquote key={t.name} className="site-testimonial">
              <div className="mb-5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.avatar}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-[rgba(172,22,224,0.15)]"
                />
                <div>
                  <p className="font-semibold text-[var(--site-ink)]">{t.name}</p>
                  <p className="text-xs text-[var(--site-muted)]">{t.role}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-[var(--site-muted)]">
                “{t.quote}”
              </p>
            </blockquote>
          ))}
        </div>
      </section>

      {/* Apps / integrations band */}
      <section className="site-dark-band relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-30 site-hero-dots" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center md:px-6 md:py-24">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {site.integrationsTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/65 md:text-base">
            {site.integrationsBody}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {site.integrations.map((app) => (
              <span
                key={app}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 backdrop-blur-sm transition hover:bg-white/10"
              >
                {app}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#ac16e0] via-[#8b10b8] to-[#1a0a28] px-6 py-14 text-center text-white md:px-12">
          <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-[rgba(201,255,112,0.25)] blur-2xl" />
          <div className="pointer-events-none absolute -right-8 bottom-0 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-3xl font-semibold tracking-tight md:text-5xl">
            {site.ctaTitle}
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm text-white/75 md:text-base">
            {site.ctaBody}
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register?plan=DEMO" className="site-btn-lime">
              Request a Demo
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Contact sales
            </Link>
          </div>
        </div>
      </section>

      {/* Contact strip */}
      <section className="border-t border-[var(--site-line)] bg-[var(--site-soft)]">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 md:px-6">
          <a
            href={`mailto:${site.contactEmail}`}
            className="flex items-center gap-4 rounded-2xl border border-[var(--site-line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="site-icon-blob">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--site-ink)]">Mail us</p>
              <p className="text-sm text-[var(--site-muted)]">{site.contactEmail}</p>
            </div>
          </a>
          <a
            href={`tel:${phoneTel}`}
            className="flex items-center gap-4 rounded-2xl border border-[var(--site-line)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="site-icon-blob">
              <Phone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--site-ink)]">Call us</p>
              <p className="text-sm text-[var(--site-muted)]">{site.contactPhone}</p>
            </div>
          </a>
        </div>
      </section>
    </>
  );
}
