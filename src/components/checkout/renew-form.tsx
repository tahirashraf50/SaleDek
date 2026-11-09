"use client";

import { useActionState } from "react";
import {
  renewOrPaySubscription,
  type CheckoutState,
} from "@/server/actions/checkout";
import { formatPlatformCurrency } from "@/lib/utils";

const initialState: CheckoutState = {};

type Props = {
  invoiceId?: string;
  amount: number;
  periodLabel: string;
  ctaLabel?: string;
};

export function RenewBillingForm({
  invoiceId,
  amount,
  periodLabel,
  ctaLabel = "Pay & extend plan",
}: Props) {
  const [state, formAction, pending] = useActionState(
    renewOrPaySubscription,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-[#eee8f5] bg-white p-5 shadow-sm"
    >
      {invoiceId ? <input type="hidden" name="invoiceId" value={invoiceId} /> : null}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ac16e0]">
          Pay / renew
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Amount{" "}
          <span className="font-semibold text-slate-900">
            {formatPlatformCurrency(amount)}
          </span>{" "}
          · extends access through {periodLabel}
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className={`rounded-xl px-3 py-2 text-sm ${
            state.ok
              ? "border border-amber-200 bg-amber-50 text-amber-900"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.error ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Payment recorded. Your plan expiry has been updated.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="paymentMethod"
            className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            Method
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue="JAZZCASH"
            className="h-10 w-full rounded-xl border border-[#eee8f5] bg-[#f6f3fb] px-3 text-sm outline-none focus:border-[#ac16e0]"
          >
            <option value="JAZZCASH">JazzCash</option>
            <option value="BANK">Bank transfer</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="paymentReference"
            className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
            Reference
          </label>
          <input
            id="paymentReference"
            name="paymentReference"
            required
            placeholder="JC-OK-… or bank ref"
            className="h-10 w-full rounded-xl border border-[#eee8f5] bg-[#f6f3fb] px-3 text-sm outline-none focus:border-[#ac16e0]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-xl bg-[#ac16e0] px-4 text-xs font-semibold text-white hover:bg-[#8b10b8] disabled:opacity-60"
      >
        {pending ? "Processing…" : ctaLabel}
      </button>
    </form>
  );
}
