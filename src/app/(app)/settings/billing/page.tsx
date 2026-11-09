import Link from "next/link";
import { redirect } from "next/navigation";
import { addYears } from "date-fns";
import { CreditCard, FileText } from "lucide-react";
import { RenewBillingForm } from "@/components/checkout/renew-form";
import { requireOrgSession } from "@/lib/session";
import { db } from "@/lib/db";
import { annualAmountFromMonthly } from "@/lib/saas-billing";
import { cn, formatDate, formatPlatformCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const INV_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-50 text-slate-700 ring-slate-100",
  SENT: "bg-sky-50 text-sky-800 ring-sky-100",
  PAID: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  OVERDUE: "bg-rose-50 text-rose-800 ring-rose-100",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
};

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pending?: string }>;
}) {
  const session = await requireOrgSession();
  if (session.user.role !== "ORG_ADMIN") {
    redirect("/inbox");
  }

  const { pending } = await searchParams;

  const org = await db.organization.findUnique({
    where: { id: session.organizationId },
    include: {
      plan: true,
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { plan: true },
      },
      platformInvoices: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!org) redirect("/inbox");

  const sub = org.subscriptions[0];
  const plan = sub?.plan || org.plan;
  const startedAt = sub?.startedAt || org.createdAt;
  const expiresAt = sub?.endsAt || org.trialEndsAt;
  const monthly = plan ? Number(plan.priceMonthly) : 0;
  const isPaidPlan = monthly > 0 && !(plan?.trialDays && plan.trialDays > 0);
  const openInvoice = org.platformInvoices.find((inv) =>
    ["DRAFT", "SENT", "OVERDUE"].includes(inv.status),
  );
  const renewFrom =
    sub?.endsAt && sub.endsAt > new Date() ? new Date(sub.endsAt) : new Date();
  const nextPeriodEnd = addYears(renewFrom, 1);
  const renewAmount = openInvoice
    ? Number(openInvoice.amount)
    : annualAmountFromMonthly(monthly);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Settings
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <CreditCard className="h-6 w-6 text-[#ac16e0]" />
          Billing
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Plan, subscription period, and invoices for {org.name}
        </p>
      </div>

      {pending ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Payment is awaiting confirmation. Once verified, your plan stays active
          through the invoice period end.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#eee8f5] bg-white p-5 shadow-sm md:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ac16e0]">
            Current plan
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {plan?.name || "No plan assigned"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Status:{" "}
                <span className="font-medium text-[#8b10b8]">
                  {sub?.status || org.status}
                </span>
              </p>
            </div>
            {plan && (
              <p className="text-lg font-semibold text-slate-800">
                {formatPlatformCurrency(monthly)}
                <span className="text-sm font-normal text-slate-400">/mo</span>
              </p>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#f6f3fb] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Started
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatDate(startedAt)}
              </p>
            </div>
            <div className="rounded-xl bg-[#f6f3fb] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Expires
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatDate(expiresAt)}
              </p>
            </div>
            <div className="rounded-xl bg-[#f6f3fb] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Renews
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {formatDate(sub?.renewsAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#eee8f5] bg-gradient-to-br from-[#14081c] to-[#1a0a28] p-5 text-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c9ff70]">
            Need help?
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Pay with JazzCash or bank transfer to activate or renew. Verified
            payments extend your plan expiry by one year.
          </p>
          <Link
            href="/contact"
            className="mt-4 inline-flex h-9 items-center rounded-xl bg-[#ac16e0] px-3 text-xs font-semibold text-white hover:bg-[#8b10b8]"
          >
            Contact support
          </Link>
        </div>
      </div>

      {isPaidPlan ? (
        <RenewBillingForm
          invoiceId={openInvoice?.id}
          amount={renewAmount}
          periodLabel={formatDate(
            openInvoice?.periodEnd || nextPeriodEnd,
          )}
          ctaLabel={
            openInvoice
              ? `Pay invoice ${openInvoice.number}`
              : "Pay annual renewal"
          }
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#eee8f5] bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#eee8f5] px-5 py-4">
          <FileText className="h-4 w-4 text-[#ac16e0]" />
          <h2 className="text-sm font-semibold text-slate-900">Invoices</h2>
        </div>
        {org.platformInvoices.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            No invoices yet
          </p>
        ) : (
          <div className="divide-y divide-[#eee8f5]">
            {org.platformInvoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {inv.number}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                    {inv.paymentReference
                      ? ` · ref ${inv.paymentReference}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                      INV_STYLE[inv.status] || INV_STYLE.DRAFT,
                    )}
                  >
                    {inv.status}
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatPlatformCurrency(Number(inv.amount))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
