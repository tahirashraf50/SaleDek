"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  checkoutPaidPlan,
  type CheckoutState,
} from "@/server/actions/checkout";
import { formatPlatformCurrency } from "@/lib/utils";

const initialState: CheckoutState = {};

const fieldClass =
  "h-10 w-full rounded-xl border border-[var(--site-line)] bg-[var(--site-soft)] px-3 text-sm text-[var(--site-ink)] outline-none transition placeholder:text-[var(--site-muted)]/70 focus:border-[var(--site-purple)] focus:bg-white focus:ring-2 focus:ring-[rgba(172,22,224,0.12)]";

const labelClass =
  "mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--site-muted)]";

type Props = {
  planKey: string;
  planName: string;
  monthlyPrice: number;
  annualPrice: number;
  periodLabel: string;
};

export function CheckoutForm({
  planKey,
  planName,
  monthlyPrice,
  annualPrice,
  periodLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(checkoutPaidPlan, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="plan" value={planKey} />

      {state.error && !state.ok ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--site-soft)] px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--site-ink)]">{planName}</p>
          <p className="text-[11px] text-[var(--site-muted)]">
            Annual · until {periodLabel}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-[var(--site-ink)]">
            {formatPlatformCurrency(annualPrice)}
          </p>
          <p className="text-[10px] text-[var(--site-muted)]">
            {formatPlatformCurrency(monthlyPrice)}/mo
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="orgName" className={labelClass}>
            Organization
          </label>
          <input
            id="orgName"
            name="orgName"
            required
            className={fieldClass}
            placeholder="Acme Corp"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="name" className={labelClass}>
            Your name
          </label>
          <input
            id="name"
            name="name"
            required
            className={fieldClass}
            placeholder="Sara Khan"
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={fieldClass}
            placeholder="you@company.com"
          />
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
            autoComplete="new-password"
            className={fieldClass}
            placeholder="Min 6 chars"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 border-t border-[var(--site-line)] pt-3">
        <div className="col-span-2">
          <label htmlFor="cardName" className={labelClass}>
            Name on card
          </label>
          <input
            id="cardName"
            name="cardName"
            required
            autoComplete="cc-name"
            className={fieldClass}
            placeholder="Name on card"
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="cardNumber" className={labelClass}>
            Card number
          </label>
          <input
            id="cardNumber"
            name="cardNumber"
            required
            inputMode="numeric"
            autoComplete="cc-number"
            className={fieldClass}
            placeholder="ACCT-000015"
          />
        </div>
        <div>
          <label htmlFor="cardExpiry" className={labelClass}>
            Expiry
          </label>
          <input
            id="cardExpiry"
            name="cardExpiry"
            required
            autoComplete="cc-exp"
            className={fieldClass}
            placeholder="MM/YY"
          />
        </div>
        <div>
          <label htmlFor="cardCvc" className={labelClass}>
            CVC
          </label>
          <input
            id="cardCvc"
            name="cardCvc"
            required
            inputMode="numeric"
            autoComplete="cc-csc"
            className={fieldClass}
            placeholder="123"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center rounded-full bg-[var(--site-purple)] text-sm font-semibold text-white transition hover:bg-[var(--site-purple-deep)] disabled:opacity-60"
      >
        {pending ? "Processing…" : `Pay ${formatPlatformCurrency(annualPrice)}`}
      </button>

      <p className="text-center text-[11px] text-[var(--site-muted)]">
        Prefer a free trial?{" "}
        <Link
          href="/register?plan=DEMO"
          className="font-medium text-[var(--site-purple)] hover:underline"
        >
          Start demo
        </Link>
      </p>
    </form>
  );
}
