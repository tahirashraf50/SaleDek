import Link from "next/link";
import { db } from "@/lib/db";
import { buildMarketingMetadata } from "@/lib/platform-website";
import { formatPlatformCurrency } from "@/lib/utils";

export async function generateMetadata() {
  return buildMarketingMetadata("pricing");
}

export default async function PricingPage() {
  const plans = await db.saaSPlan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <>
      <section className="site-hero-glow pt-28 pb-16 md:pt-32 md:pb-20">
        <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
          <span className="site-pill">Pricing</span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--site-ink)] md:text-6xl">
            Packages for every team size
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[var(--site-muted)]">
            Start a free demo, or checkout a paid plan — payment activates your subscription
            through the annual expiry date.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const features = Array.isArray(plan.features)
              ? (plan.features as string[])
              : [];
            const featured = plan.key === "PRO";
            const isDemo = plan.key === "DEMO" || Boolean(plan.trialDays);
            const price = Number(plan.priceMonthly);
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-[1.75rem] border bg-white p-7 ${
                  featured
                    ? "border-[var(--site-purple)] shadow-[0_24px_50px_-28px_rgba(172,22,224,0.45)] ring-1 ring-[rgba(172,22,224,0.25)] xl:-translate-y-2"
                    : isDemo
                      ? "border-[rgba(201,255,112,0.9)] shadow-[0_16px_40px_-32px_rgba(15,37,82,0.25)]"
                      : "border-[var(--site-line)] shadow-[0_16px_40px_-32px_rgba(31,31,31,0.25)]"
                }`}
              >
                {featured ? (
                  <span className="mb-3 w-fit text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--site-purple)]">
                    Most chosen
                  </span>
                ) : isDemo ? (
                  <span className="mb-3 w-fit text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5a7a14]">
                    {plan.trialDays || 15}-day free demo
                  </span>
                ) : (
                  <span className="mb-3 h-4" />
                )}
                <div className="text-sm font-medium text-[var(--site-muted)]">{plan.name}</div>
                <div className="mt-2 text-4xl font-semibold text-[var(--site-ink)]">
                  {price === 0 ? "Free" : formatPlatformCurrency(price)}
                  {price > 0 ? (
                    <span className="text-base font-normal text-[var(--site-muted)]">/mo USD</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
                  {plan.description}
                </p>
                <ul className="mt-7 flex-1 space-y-2.5 text-sm text-[var(--site-ink)]">
                  {features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className="mt-0.5 text-[var(--site-purple)]" aria-hidden>
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={
                    isDemo || price <= 0
                      ? `/register?plan=${plan.key}`
                      : `/checkout?plan=${plan.key}`
                  }
                  className={`mt-8 block rounded-full px-4 py-2.5 text-center text-sm font-semibold transition ${
                    featured
                      ? "bg-[var(--site-purple)] text-white hover:bg-[var(--site-purple-deep)]"
                      : isDemo
                        ? "bg-[var(--site-lime)] text-[#0f2552] hover:brightness-95"
                        : "bg-[var(--site-ink)] text-white hover:bg-black"
                  }`}
                >
                  {isDemo || price <= 0
                    ? `Start ${plan.trialDays || 15}-day demo`
                    : `Buy ${plan.name}`}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-12 text-center text-sm text-[var(--site-muted)]">
          Need a custom enterprise setup?{" "}
          <Link
            href="/contact"
            className="font-medium text-[var(--site-purple)] underline-offset-2 hover:underline"
          >
            Contact us
          </Link>
        </p>
      </div>
    </>
  );
}
