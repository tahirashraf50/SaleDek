import Link from "next/link";
import { redirect } from "next/navigation";
import { addYears } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { SaaSPlanKey } from "@prisma/client";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { db } from "@/lib/db";
import { getWebsiteSettings } from "@/lib/platform-website";
import { annualAmountFromMonthly } from "@/lib/saas-billing";
import { formatDate } from "@/lib/utils";

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
    <div className="site-hero-glow relative flex min-h-[100dvh] flex-col">
      <header className="relative z-10 mx-auto flex w-full max-w-lg items-center justify-between px-4 py-3">
        <Link href="/" className="inline-flex items-center gap-2">
          {site.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.logoUrl}
              alt={site.brandName}
              className="h-7 w-auto max-w-[120px] object-contain"
            />
          ) : (
            <span className="text-sm font-semibold tracking-tight text-[var(--site-ink)]">
              {site.brandName}
            </span>
          )}
        </Link>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--site-muted)] transition hover:text-[var(--site-purple)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Pricing
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 pb-4 pt-1">
        <div className="site-anim-fade rounded-2xl border border-[var(--site-line)] bg-white/95 p-5 shadow-[0_20px_50px_-30px_rgba(172,22,224,0.4)] backdrop-blur-sm sm:p-6">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--site-purple)]">
              Checkout
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--site-ink)]">
              Activate {plan.name}
            </h1>
          </div>

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
