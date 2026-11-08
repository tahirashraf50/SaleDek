"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ORG_CURRENCIES } from "@/lib/currency";
import { updateOrganizationCurrency } from "@/server/actions/settings";
import { formatCurrency } from "@/lib/utils";

export function CurrencySettingsForm({
  initialCurrency,
}: {
  initialCurrency: string;
}) {
  const router = useRouter();
  const [currency, setCurrency] = useState(initialCurrency || "PKR");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updateOrganizationCurrency(currency);
        toast.success("Currency updated");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="currency"
          className="text-xs font-medium text-slate-500"
        >
          Display currency
        </label>
        <select
          id="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-[#eee8f5] bg-[#f6f3fb] px-3 text-sm text-slate-900 outline-none transition focus:border-[#ac16e0] focus:bg-white focus:ring-2 focus:ring-[rgba(172,22,224,0.15)]"
        >
          {ORG_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Used for prices, invoices, deals, and reports in your workspace
        </p>
      </div>

      <div className="rounded-xl bg-[#f6f3fb] px-3 py-2.5 ring-1 ring-[#eee8f5]">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Preview
        </p>
        <p className="mt-1 text-lg font-semibold text-slate-900">
          {formatCurrency(125000, currency)}
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={pending || currency === initialCurrency}
          onClick={save}
          className="inline-flex h-9 items-center rounded-xl bg-[#ac16e0] px-4 text-xs font-semibold text-white hover:bg-[#8b10b8] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save currency"}
        </button>
      </div>
    </div>
  );
}
