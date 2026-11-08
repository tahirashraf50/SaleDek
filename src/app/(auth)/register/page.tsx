import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SaaSPlanKey } from "@prisma/client";
import { db } from "@/lib/db";
import { registerOrganization } from "@/server/actions/auth";
import { formatCurrency } from "@/lib/utils";
import { getWebsiteSettings } from "@/lib/platform-website";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ plan?: string }> };

const fieldClass =
  "h-12 w-full rounded-2xl border border-[var(--site-line)] bg-[var(--site-soft)] px-4 text-sm text-[var(--site-ink)] outline-none transition focus:border-[var(--site-purple)] focus:bg-white focus:ring-4 focus:ring-[rgba(172,22,224,0.12)]";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--site-muted)]";

export default async function RegisterPage({ searchParams }: Props) {
  const site = await getWebsiteSettings();
  const { plan: planParam } = await searchParams;
  const plans = await db.saaSPlan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  const selected =
    plans.find((p) => p.key === (planParam?.toUpperCase() as SaaSPlanKey)) ||
    plans.find((p) => p.key === "STARTER") ||
    plans[0];

  const planNote = selected
    ? selected.trialDays
      ? `Plan: ${selected.name} — free ${selected.trialDays}-day demo`
      : `Plan: ${selected.name} (${formatCurrency(Number(selected.priceMonthly))}/mo)`
    : "Multi-tenant SaaS org signup";

  return (
    <div className="site-hero-glow relative flex min-h-screen flex-col">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          {site.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.logoUrl}
              alt=""
              className="h-9 w-auto rounded-md object-contain"
            />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--site-purple)] text-sm font-bold text-white">
              {site.brandName.slice(0, 1)}
            </span>
          )}
          <span className="text-lg font-semibold tracking-tight text-[var(--site-ink)]">
            {site.brandName}
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--site-muted)] transition hover:text-[var(--site-purple)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to site
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 md:px-6">
        <div className="site-anim-fade w-full max-w-[420px]">
          <div className="mb-8 text-center">
            <span className="site-pill">Get started</span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-4xl">
              Create your workspace
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">{planNote}</p>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--site-line)] bg-white/90 p-7 shadow-[0_28px_60px_-36px_rgba(172,22,224,0.45)] backdrop-blur-sm md:p-8">
            <form action={registerOrganization} className="space-y-4">
              <div>
                <label htmlFor="plan" className={labelClass}>
                  Package
                </label>
                <select
                  id="plan"
                  name="plan"
                  defaultValue={selected?.key || "DEMO"}
                  className={fieldClass}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.key}>
                      {p.trialDays
                        ? `${p.name} — ${p.trialDays}-day free demo`
                        : `${p.name} — ${formatCurrency(Number(p.priceMonthly))}/mo`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="orgName" className={labelClass}>
                  Organization
                </label>
                <input id="orgName" name="orgName" required className={fieldClass} />
              </div>
              <div>
                <label htmlFor="name" className={labelClass}>
                  Your name
                </label>
                <input id="name" name="name" required className={fieldClass} />
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <input id="email" name="email" type="email" required className={fieldClass} />
              </div>
              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  className={fieldClass}
                />
              </div>
              <button type="submit" className="site-btn-primary mt-2 w-full">
                Create account
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--site-muted)]">
              <Link
                href="/pricing"
                className="font-semibold text-[var(--site-purple)] hover:underline"
              >
                Compare packages
              </Link>
              {" · "}
              <Link href="/login" className="font-semibold text-[var(--site-purple)] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
