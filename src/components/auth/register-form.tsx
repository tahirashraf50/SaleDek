"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  registerOrganization,
  type RegisterState,
} from "@/server/actions/auth";
import { formatPlatformCurrency } from "@/lib/utils";

const initialState: RegisterState = {};

const fieldClass =
  "h-12 w-full rounded-2xl border border-[var(--site-line)] bg-[var(--site-soft)] px-4 text-sm text-[var(--site-ink)] outline-none transition focus:border-[var(--site-purple)] focus:bg-white focus:ring-4 focus:ring-[rgba(172,22,224,0.12)]";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--site-muted)]";

type PlanOption = {
  id: string;
  key: string;
  name: string;
  priceMonthly: number;
  trialDays: number | null;
};

export function RegisterForm({
  plans,
  selectedKey,
}: {
  plans: PlanOption[];
  selectedKey: string;
}) {
  const [state, formAction, pending] = useActionState(
    registerOrganization,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="plan" className={labelClass}>
          Package
        </label>
        <select
          id="plan"
          name="plan"
          defaultValue={selectedKey}
          className={fieldClass}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.key}>
              {p.trialDays
                ? `${p.name} — ${p.trialDays}-day free demo`
                : `${p.name} — ${formatPlatformCurrency(p.priceMonthly)}/mo`}
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
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={fieldClass}
          placeholder="you@company.com"
        />
        <p className="mt-1.5 text-[11px] text-[var(--site-muted)]">
          Official company domain only — Gmail / Yahoo / Outlook not accepted.
        </p>
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
      <button
        type="submit"
        disabled={pending}
        className="site-btn-primary mt-2 w-full disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create account"}
      </button>

      <p className="text-center text-sm text-[var(--site-muted)]">
        <Link
          href="/pricing"
          className="font-semibold text-[var(--site-purple)] hover:underline"
        >
          Compare packages
        </Link>
        {" · "}
        <Link
          href="/login"
          className="font-semibold text-[var(--site-purple)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
