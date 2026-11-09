import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SaaSPlanKey } from "@prisma/client";
import { db } from "@/lib/db";
import { RegisterForm } from "@/components/auth/register-form";
import { formatPlatformCurrency } from "@/lib/utils";
import { getWebsiteSettings } from "@/lib/platform-website";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ plan?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const site = await getWebsiteSettings();
  const { plan: planParam } = await searchParams;
  const plans = await db.saaSPlan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  const selected =
    plans.find((p) => p.key === (planParam?.toUpperCase() as SaaSPlanKey)) ||
    plans.find((p) => p.key === "DEMO") ||
    plans.find((p) => p.key === "STARTER") ||
    plans[0];

  if (
    selected &&
    Number(selected.priceMonthly) > 0 &&
    !(selected.trialDays && selected.trialDays > 0)
  ) {
    redirect(`/checkout?plan=${selected.key}`);
  }

  const planNote = selected
    ? selected.trialDays
      ? `Plan: ${selected.name} — free ${selected.trialDays}-day demo`
      : `Plan: ${selected.name} (${formatPlatformCurrency(Number(selected.priceMonthly))}/mo)`
    : "Multi-tenant SaaS org signup";

  return (
    <div className="site-hero-glow relative flex min-h-screen flex-col">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          {site.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.logoUrl}
              alt={site.brandName}
              className="h-9 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--site-purple)] text-sm font-bold text-white">
                {site.brandName.slice(0, 1)}
              </span>
              <span className="text-lg font-semibold tracking-tight text-[var(--site-ink)]">
                {site.brandName}
              </span>
            </>
          )}
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
            <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">
              {planNote}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--site-line)] bg-white/90 p-7 shadow-[0_28px_60px_-36px_rgba(172,22,224,0.45)] backdrop-blur-sm md:p-8">
            <RegisterForm
              selectedKey={selected?.key || "DEMO"}
              plans={plans.map((p) => ({
                id: p.id,
                key: p.key,
                name: p.name,
                priceMonthly: Number(p.priceMonthly),
                trialDays: p.trialDays,
              }))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
