"use client";

import { useActionState } from "react";
import {
  renewOrPaySubscription,
  type CheckoutState,
} from "@/server/actions/checkout";
import { formatPlatformCurrency } from "@/lib/utils";

const initialState: CheckoutState = {};

const fieldClass =
  "h-10 w-full rounded-xl border border-[#eee8f5] bg-[#f6f3fb] px-3 text-sm outline-none focus:border-[#ac16e0]";

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
          Credit card
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
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
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

      <div>
        <label
          htmlFor="cardName"
          className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
        >
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
      <div>
        <label
          htmlFor="cardNumber"
          className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
        >
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="cardExpiry"
            className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
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
          <label
            htmlFor="cardCvc"
            className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
          >
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
        className="inline-flex h-10 items-center rounded-xl bg-[#ac16e0] px-4 text-xs font-semibold text-white hover:bg-[#8b10b8] disabled:opacity-60"
      >
        {pending ? "Processing…" : ctaLabel}
      </button>
    </form>
  );
}
