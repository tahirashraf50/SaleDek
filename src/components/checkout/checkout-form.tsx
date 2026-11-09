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
  "h-12 w-full rounded-2xl border border-[var(--site-line)] bg-[var(--site-soft)] px-4 text-sm text-[var(--site-ink)] outline-none transition focus:border-[var(--site-purple)] focus:bg-white focus:ring-4 focus:ring-[rgba(172,22,224,0.12)]";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--site-muted)]";

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
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="plan" value={planKey} />

      {state.error && !state.ok ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-[var(--site-line)] bg-[var(--site-soft)]/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--site-muted)]">
          Order summary
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[var(--site-ink)]">{planName}</p>
            <p className="text-sm text-[var(--site-muted)]">
              Billed annually · access until {periodLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-[var(--site-ink)]">
              {formatPlatformCurrency(annualPrice)}
            </p>
            <p className="text-xs text-[var(--site-muted)]">
              {formatPlatformCurrency(monthlyPrice)}/mo × 12
            </p>
          </div>
        </div>
      </div>

      <div>
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
      <div>
        <label htmlFor="name" className={labelClass}>
          Your name
        </label>
        <input id="name" name="name" required className={fieldClass} placeholder="Sara Khan" />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Work email
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
        />
      </div>

      <div className="border-t border-[var(--site-line)] pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--site-muted)]">
          Credit card
        </p>
        <div>
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
        <div className="mt-3">
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
        <div className="mt-3 grid grid-cols-2 gap-3">
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
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--site-purple)] text-sm font-semibold text-white transition hover:bg-[var(--site-purple-deep)] disabled:opacity-60"
      >
        {pending ? "Processing…" : `Pay ${formatPlatformCurrency(annualPrice)} & activate`}
      </button>

      <p className="text-center text-xs text-[var(--site-muted)]">
        Prefer a free trial?{" "}
        <Link href="/register?plan=DEMO" className="font-medium text-[var(--site-purple)] hover:underline">
          Start demo
        </Link>
      </p>
    </form>
  );
}
