import Link from "next/link";
import { Car, FileText, Hash, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { OrderFormValue } from "@/lib/product-form";

export type CustomerVehiclePolicy = {
  orderId: string;
  orderNumber: number;
  paymentStatus: string;
  total: number;
  date: string;
  productName: string;
  fields: OrderFormValue[];
  policyNumber?: string | null;
  underwritingStatus?: string | null;
  policyDocumentId?: string | null;
  policyDocumentLabel?: string | null;
};

export function CustomerVehicles({
  policies,
  compact,
}: {
  policies: CustomerVehiclePolicy[];
  compact?: boolean;
}) {
  if (!policies.length) {
    if (compact) return null;
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <span className="h-4 w-1 rounded-sm bg-sky-500" />
          <Car className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">
            Insured vehicles / policies
          </h2>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-500">
            No vehicle policy details yet — they appear after a sale form with Make
            &amp; Model, Registration, etc. is filled. Underwriting policy # and
            documents also show here once issued.
          </p>
        </div>
      </div>
    );
  }

  const body = (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {policies.map((p) => (
        <div
          key={`${p.orderId}-${p.productName}`}
          className="rounded-xl border border-slate-200 bg-white p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{p.productName}</p>
              <p className="text-[11px] text-slate-500">
                Order #{p.orderNumber} · {formatDate(p.date)} ·{" "}
                {formatCurrency(p.total)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge color={p.paymentStatus === "PAID" ? "green" : "amber"}>
                {p.paymentStatus === "PAID" || p.paymentStatus === "CLEARED"
                  ? "Payment confirmed"
                  : p.paymentStatus}
              </Badge>
              {p.underwritingStatus === "SENT" ? (
                <Badge color="green">Policy emailed</Badge>
              ) : p.policyNumber ? (
                <Badge color="teal">UW {p.underwritingStatus}</Badge>
              ) : p.underwritingStatus ? (
                <Badge color="amber">UW {p.underwritingStatus}</Badge>
              ) : null}
            </div>
          </div>

          {p.policyNumber ? (
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <Hash className="h-4 w-4 shrink-0 text-amber-700" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
                  Policy #
                </p>
                <p className="truncate font-mono text-sm font-bold text-amber-950">
                  {p.policyNumber}
                </p>
              </div>
              <Shield className="ml-auto h-4 w-4 shrink-0 text-amber-600/70" />
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-slate-400">
              Policy # pending underwriting
            </p>
          )}

          <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {p.fields.map((f) => (
              <div
                key={`${f.label}-${f.value}`}
                className="rounded-md bg-slate-50 px-2.5 py-1.5"
              >
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {f.label}
                </dt>
                <dd className="text-sm text-slate-900">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {p.policyDocumentId ? (
              <a
                href={`/api/attachments/${p.policyDocumentId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#8b10b8] hover:underline"
              >
                <FileText className="h-3.5 w-3.5" />
                {p.policyDocumentLabel || "Policy document"}
              </a>
            ) : null}
            <Link
              href={`/underwriting/${p.orderId}`}
              className="font-medium text-slate-500 hover:text-slate-800 hover:underline"
            >
              Underwriting case →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );

  if (compact) {
    return (
      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Insured vehicles / policies
        </h4>
        {body}
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-sm bg-sky-500" />
          <Car className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">
            Insured vehicles / policies
          </h2>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          {policies.length}
        </span>
      </div>
      <div className="p-5">{body}</div>
    </div>
  );
}
