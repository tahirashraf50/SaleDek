import Link from "next/link";
import { redirect } from "next/navigation";
import { addYears } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { SaaSPlanKey } from "@prisma/client";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { db } from "@/lib/db";
import { getWebsiteSettings } from "@/lib/platform-website";
import { annualAmountFromMonthly } from "@/lib/saas-billing";
import { formatDate, formatPlatformCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ plan?: string }> };

export default async function CheckoutPage({ searchParams }: Props) {
  const site = await getWebsiteSettings();
  const { plan: planParam } = await searchParams;
  const planKey = (planParam || "").toUpperCase() as SaaSPlanKey;

  const plan = await db.saaSPlan.findUnique({ where: { key: planKey } });
  if (!plan || !plan.active) redirect("/pricing");

  const monthly = Number(plan.priceMonthly);
  const isFree = monthly <= 0 || Boolean(plan.trialDays && plan.trialDays > 0);
  if (isFree) redirect(`/register?plan=${plan.key}`);

  const annual = annualAmountFromMonthly(monthly);
  const periodEnd = addYears(new Date(), 1);

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
          href="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--site-muted)] transition hover:text-[var(--site-purple)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pricing
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 py-10 md:grid-cols-[1fr_1.1fr] md:px-6 md:py-14">
        <div className="site-anim-fade md:pt-6">
          <span className="site-pill">Checkout</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-4xl">
            Activate {plan.name}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--site-muted)]">
            Pay the annual subscription to unlock your workspace. Your plan stays
            active until{" "}
            <span className="font-medium text-[var(--site-ink)]">
              {formatDate(periodEnd)}
            </span>
            — renew before then to keep uninterrupted access.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-[var(--site-ink)]">
            <li className="flex gap-2">
              <span className="text-[var(--site-purple)]">✓</span>
              Annual billing: {formatPlatformCurrency(annual)} (
              {formatPlatformCurrency(monthly)}/mo × 12)
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--site-purple)]">✓</span>
              Subscription expiry linked to this payment period
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--site-purple)]">✓</span>
              Pay by credit card — plan activates instantly through expiry
            </li>
          </ul>
        </div>

        <div className="site-anim-fade rounded-[1.75rem] border border-[var(--site-line)] bg-white/90 p-7 shadow-[0_28px_60px_-36px_rgba(172,22,224,0.45)] backdrop-blur-sm md:p-8">
          <CheckoutForm
            planKey={plan.key}
            planName={plan.name}
            monthlyPrice={monthly}
            annualPrice={annual}
            periodLabel={formatDate(periodEnd)}
          />
        </div>
      </main>
    </div>
  );
}
