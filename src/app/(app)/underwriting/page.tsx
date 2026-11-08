import Link from "next/link";
import {
  ClipboardCheck,
  FileText,
  Hash,
  MailCheck,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { UnderwritingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { assertModuleAccess } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UnderwritingAssign } from "@/components/underwriting/underwriting-assign";
import { listUnderwritingAssignees } from "@/server/actions/underwriting";

type Props = {
  searchParams: Promise<{ q?: string; status?: string; assignee?: string }>;
};

const STATUS_CHIPS: { id: string; label: string; status?: UnderwritingStatus }[] =
  [
    { id: "", label: "All" },
    { id: "PENDING", label: "Pending", status: "PENDING" },
    { id: "IN_REVIEW", label: "In review", status: "IN_REVIEW" },
    { id: "POLICY_READY", label: "Doc ready", status: "POLICY_READY" },
    { id: "SENT", label: "Sent", status: "SENT" },
  ];

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-100",
  IN_REVIEW: "bg-sky-50 text-sky-800 ring-sky-100",
  POLICY_READY: "bg-violet-50 text-violet-800 ring-violet-100",
  SENT: "bg-emerald-50 text-emerald-800 ring-emerald-100",
};

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-amber-500",
  IN_REVIEW: "bg-sky-500",
  POLICY_READY: "bg-violet-500",
  SENT: "bg-emerald-500",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR = ["#f59e0b", "#0ea5e9", "#8b5cf6", "#ef1e1e", "#10b981", "#64748b"];

export default async function UnderwritingQueuePage({ searchParams }: Props) {
  const session = await requireOrgSession();
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

  await assertModuleAccess(session, "UNDERWRITING");

  const baseWhere = { organizationId: orgId };
  const assigneeWhere =
    assigneeFilter === null
      ? { underwritingAssigneeId: null }
      : assigneeFilter
        ? { underwritingAssigneeId: assigneeFilter }
        : {};

  const [
    orders,
    totalAll,
    pendingCount,
    reviewCount,
    readyCount,
    sentCount,
    openValue,
    agents,
  ] = await Promise.all([
    db.order.findMany({
      where: {
        ...baseWhere,
        ...assigneeWhere,
        ...(statusFilter ? { underwritingStatus: statusFilter } : {}),
        ...(query
          ? {
              OR: [
                {
                  policyNumber: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
                {
                  customer: {
                    name: { contains: query, mode: "insensitive" as const },
                  },
                },
                Number.isFinite(Number(query))
                  ? { number: Number(query) }
                  : undefined,
              ].filter(Boolean) as object[],
            }
          : {}),
      },
      orderBy: [{ underwritingStatus: "asc" }, { createdAt: "desc" }],
      take: 80,
      include: {
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
        items: { select: { name: true }, take: 2 },
        attachments: {
          where: { label: { startsWith: "Policy —" } },
          select: { id: true },
          take: 1,
        },
        underwritingAssignee: { select: { id: true, name: true } },
      },
    }),
    db.order.count({ where: baseWhere }),
    db.order.count({ where: { ...baseWhere, underwritingStatus: "PENDING" } }),
    db.order.count({
      where: { ...baseWhere, underwritingStatus: "IN_REVIEW" },
    }),
    db.order.count({
      where: { ...baseWhere, underwritingStatus: "POLICY_READY" },
    }),
    db.order.count({ where: { ...baseWhere, underwritingStatus: "SENT" } }),
    db.order.aggregate({
      where: {
        ...baseWhere,
        underwritingStatus: { in: ["PENDING", "IN_REVIEW", "POLICY_READY"] },
      },
      _sum: { total: true },
    }),
    listUnderwritingAssignees(),
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
    return s ? `/underwriting?${s}` : "/underwriting";
  }

  const chipCounts: Record<string, number> = {
    "": totalAll,
    PENDING: pendingCount,
    IN_REVIEW: reviewCount,
    POLICY_READY: readyCount,
    SENT: sentCount,
  };

  const openCount = pendingCount + reviewCount + readyCount;
  const pendingValue = Number(openValue._sum.total ?? 0);

  return (
    <div className="space-y-5">
      {/* Header — Dreams style */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Underwriting
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {["U", "W", "P", "E"].map((letter, i) => (
                <div
                  key={letter}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm"
                  style={{
                    backgroundColor: ["#f59e0b", "#0ea5e9", "#8b5cf6", "#10b981"][
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
              {openCount} open · {formatCurrency(pendingValue)} in flight
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
            {format(weekStart, "dd MMM yy")} – {format(now, "dd MMM yy")}
          </div>
          <form action="/underwriting" method="get" className="flex gap-2">
            {statusFilter ? (
              <input type="hidden" name="status" value={statusFilter} />
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
            href="/underwriting"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Queue</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">{openCount} open</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 text-white shadow-md shadow-amber-600/25">
              <Shield className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Awaiting number</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {pendingCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">New sales</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Hash className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Doc ready</p>
              <p className="mt-1 text-2xl font-bold text-violet-600">
                {readyCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Ready to email</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <FileText className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Sent</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {sentCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Completed</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MailCheck className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">Cases</h2>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_CHIPS.map((f) => {
                const active = (params.status || "") === f.id;
                return (
                  <Link
                    key={f.id || "all"}
                    href={href({ status: active && f.id ? "" : f.id })}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                      active
                        ? "bg-amber-600 text-white shadow-sm"
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
            {orders.map((o, i) => (
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
                        STATUS_STYLE[o.underwritingStatus]
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          STATUS_DOT[o.underwritingStatus]
                        )}
                      />
                      {o.underwritingStatus.replace(/_/g, " ")}
                    </span>
                    {o.attachments.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700">
                        <FileText className="h-3 w-3" /> Doc
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
                    {o.items.map((it) => it.name).join(" · ") || "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {formatDate(o.createdAt)} · {formatCurrency(Number(o.total))}
                    {o.policyNumber ? (
                      <>
                        {" · "}
                        <span className="font-mono font-semibold text-amber-800">
                          {o.policyNumber}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <UnderwritingAssign
                  orderId={o.id}
                  assigneeId={o.underwritingAssigneeId}
                  agents={agents}
                  compact
                />
                <Link
                  href={`/underwriting/${o.id}`}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm transition",
                    o.underwritingStatus === "SENT"
                      ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      : "bg-amber-600 text-white shadow-amber-600/20 hover:bg-amber-700"
                  )}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {o.underwritingStatus === "SENT" ? "View" : "Open"}
                </Link>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Shield className="h-6 w-6" />
                </div>
                <p className="font-semibold text-slate-800">No cases found</p>
                <p className="mt-1 text-sm text-slate-500">
                  New sales land here automatically.
                </p>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
