import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  ClipboardCheck,
  CreditCard,
  Hourglass,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { FinanceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { assertModuleAccess } from "@/lib/modules";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { listFinanceAssignees } from "@/server/actions/finance";
import { FinanceAssign } from "@/components/finance/finance-assign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  searchParams: Promise<{ q?: string; status?: string; assignee?: string }>;
};

const STATUS_CHIPS: {
  id: string;
  label: string;
  status?: FinanceStatus;
}[] = [
  { id: "", label: "Open" },
  { id: "PENDING", label: "Pending", status: "PENDING" },
  { id: "IN_REVIEW", label: "In review", status: "IN_REVIEW" },
  { id: "CLEARED", label: "Cleared", status: "CLEARED" },
];

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-100",
  IN_REVIEW: "bg-sky-50 text-sky-800 ring-sky-100",
  CLEARED: "bg-emerald-50 text-emerald-800 ring-emerald-100",
};

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-500",
  IN_REVIEW: "bg-sky-500",
  CLEARED: "bg-emerald-500",
};

const PAY_STYLE: Record<string, string> = {
  PENDING: "text-rose-700",
  PARTIAL: "text-amber-700",
  OVERDUE: "text-rose-800",
  BOUNCED: "text-rose-800",
  RECEIVED: "text-sky-700",
  PAID: "text-emerald-700",
  CLEARED: "text-emerald-700",
};

const AVATAR = ["#ac16e0", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b"];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function FinanceQueuePage({ searchParams }: Props) {
  const session = await requireOrgSession();
  await assertModuleAccess(session, "FINANCE");
  const orgId = session.organizationId;
  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter = STATUS_CHIPS.find((c) => c.id === params.status)?.status;
  const assigneeParam = params.assignee?.trim() || "";
  const assigneeFilter =
    assigneeParam === "me"
      ? session.user.id
      : assigneeParam === "unassigned"
        ? null
        : assigneeParam || undefined;
  const now = new Date();
  const weekStart = subDays(now, 6);

  const baseWhere = { organizationId: orgId };
  const assigneeWhere =
    assigneeFilter === null
      ? { financeAssigneeId: null }
      : assigneeFilter
        ? { financeAssigneeId: assigneeFilter }
        : {};

  const [
    orders,
    pending,
    review,
    cleared,
    openValue,
    unpaidCount,
    agents,
  ] = await Promise.all([
    db.order.findMany({
      where: {
        ...baseWhere,
        ...assigneeWhere,
        ...(statusFilter
          ? { financeStatus: statusFilter }
          : { financeStatus: { in: ["PENDING", "IN_REVIEW"] } }),
        ...(query
          ? {
              OR: [
                {
                  customer: {
                    name: { contains: query },
                  },
                },
                Number.isFinite(Number(query))
                  ? { number: Number(query) }
                  : undefined,
              ].filter(Boolean) as object[],
            }
          : {}),
      },
      orderBy: [{ financeStatus: "asc" }, { createdAt: "desc" }],
      take: 80,
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        financeAssignee: { select: { id: true, name: true } },
        items: { select: { name: true }, take: 2 },
        installments: {
          where: { status: { not: "PAID" } },
          select: { id: true, amount: true },
        },
      },
    }),
    db.order.count({
      where: { ...baseWhere, financeStatus: "PENDING" },
    }),
    db.order.count({
      where: { ...baseWhere, financeStatus: "IN_REVIEW" },
    }),
    db.order.count({
      where: { ...baseWhere, financeStatus: "CLEARED" },
    }),
    db.order.aggregate({
      where: {
        ...baseWhere,
        financeStatus: { in: ["PENDING", "IN_REVIEW"] },
      },
      _sum: { total: true },
    }),
    db.order.count({
      where: {
        ...baseWhere,
        financeStatus: { in: ["PENDING", "IN_REVIEW"] },
        paymentStatus: { in: ["PENDING", "PARTIAL", "OVERDUE", "BOUNCED"] },
      },
    }),
    listFinanceAssignees(),
  ]);

  function href(next: { q?: string; status?: string; assignee?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const status = next.status !== undefined ? next.status : params.status;
    const assignee =
      next.assignee !== undefined ? next.assignee : assigneeParam;
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    if (assignee) qs.set("assignee", assignee);
    const s = qs.toString();
    return s ? `/finance?${s}` : "/finance";
  }

  const openCount = pending + review;
  const pendingValue = Number(openValue._sum.total ?? 0);
  const chipCounts: Record<string, number> = {
    "": openCount,
    PENDING: pending,
    IN_REVIEW: review,
    CLEARED: cleared,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Finance
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {["P", "R", "C", "F"].map((letter, i) => (
                <div
                  key={letter}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm"
                  style={{
                    backgroundColor: ["#f59e0b", "#0ea5e9", "#10b981", "#ac16e0"][
                      i
                    ],
                    zIndex: 4 - i,
                  }}
                >
                  {letter}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              {openCount} open · {formatCurrency(pendingValue)} to clear
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
            {format(weekStart, "dd MMM yy")} – {format(now, "dd MMM yy")}
          </div>
          <form action="/finance" method="get" className="flex gap-2">
            {statusFilter ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            {assigneeParam ? (
              <input type="hidden" name="assignee" value={assigneeParam} />
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                name="q"
                placeholder="Search cases…"
                defaultValue={query || ""}
                className="h-9 w-52 border-slate-200 bg-white pl-9 shadow-sm sm:w-60"
              />
            </div>
            <Button type="submit" variant="outline" className="h-9 bg-white">
              Search
            </Button>
          </form>
          <Link
            href="/finance"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Open pipeline</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatCurrency(pendingValue)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {openCount} cases awaiting clear
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ac16e0] text-white shadow-md shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Pending</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{pending}</p>
              <p className="mt-1 text-[11px] text-slate-400">Needs confirmation</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Hourglass className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">In review</p>
              <p className="mt-1 text-2xl font-bold text-sky-600">{review}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {unpaidCount} still unpaid / partial
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <CreditCard className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Cleared</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{cleared}</p>
              <p className="mt-1 text-[11px] text-slate-400">Fully settled</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <BadgeCheck className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
            <Banknote className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Cases</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map((f) => {
              const active = (params.status || "") === f.id;
              return (
                <Link
                  key={f.id || "open"}
                  href={href({ status: active && f.id ? "" : f.id })}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                    active
                      ? "bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.35)]"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "rounded-md px-1 text-[10px]",
                      active ? "bg-white/20" : "bg-white text-slate-500"
                    )}
                  >
                    {chipCounts[f.id] ?? 0}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-50 px-5 py-2.5">
          {(
            [
              { id: "", label: "All agents" },
              { id: "me", label: "Assigned to me" },
              { id: "unassigned", label: "Unassigned" },
              ...agents.slice(0, 8).map((a) => ({
                id: a.id,
                label: a.name.split(" ")[0] || a.name,
              })),
            ] as { id: string; label: string }[]
          ).map((f) => {
            const active = assigneeParam === f.id;
            return (
              <Link
                key={f.id || "all-agents"}
                href={href({ assignee: active && f.id ? "" : f.id })}
                className={cn(
                  "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold transition",
                  active
                    ? "bg-slate-800 text-white"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <div className="divide-y divide-slate-50">
          {orders.map((o, i) => {
            const product = o.items[0]?.name.split(" · ")[0] || "—";
            const openInstallments = o.installments.length;
            const installmentDue = o.installments.reduce(
              (sum, inst) => sum + Number(inst.amount),
              0
            );

            return (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50/90"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: AVATAR[i % AVATAR.length] }}
                >
                  {initials(o.customer.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">
                      Order #{o.number}
                    </p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                        STATUS_STYLE[o.financeStatus]
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          STATUS_DOT[o.financeStatus]
                        )}
                      />
                      {o.financeStatus.replace(/_/g, " ")}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        PAY_STYLE[o.paymentStatus] || "text-slate-500"
                      )}
                    >
                      Pay {o.paymentStatus}
                    </span>
                    {openInstallments > 0 ? (
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-100">
                        {openInstallments} installment
                        {openInstallments === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    <Link
                      href={`/customers/${o.customer.id}`}
                      className="font-medium text-slate-700 hover:underline"
                    >
                      {o.customer.name}
                    </Link>
                    {" · "}
                    {product}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {formatDate(o.createdAt)} ·{" "}
                    <span className="font-semibold text-slate-700">
                      {formatCurrency(Number(o.total))}
                    </span>
                    {openInstallments > 0 ? (
                      <>
                        {" · "}
                        <span className="font-medium text-amber-800">
                          {formatCurrency(installmentDue)} open
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <FinanceAssign
                  orderId={o.id}
                  assigneeId={o.financeAssigneeId}
                  agents={agents}
                  compact
                />
                <Link
                  href={`/finance/${o.id}`}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm transition",
                    o.financeStatus === "CLEARED"
                      ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      : "bg-[#ac16e0] text-white shadow-[0_10px_24px_-12px_rgba(172,22,224,0.35)] hover:bg-[#8b10b8]"
                  )}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {o.financeStatus === "CLEARED" ? "View" : "Open"}
                </Link>
              </div>
            );
          })}
          {orders.length === 0 && (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(172,22,224,0.08)] text-[#8b10b8]">
                <Wallet className="h-6 w-6" />
              </div>
              <p className="font-semibold text-slate-800">No finance cases</p>
              <p className="mt-1 text-sm text-slate-500">
                Unpaid sales and open installments land here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
