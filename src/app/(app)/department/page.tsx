import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Inbox,
  MailCheck,
  RefreshCw,
  Shield,
  Ticket,
  Timer,
  TrendingUp,
} from "lucide-react";
import { format, startOfMonth, subDays } from "date-fns";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { getOrgModules, MODULE_DEFS } from "@/lib/modules";
import { updateTicketStage } from "@/server/actions/tickets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

async function setStageAction(formData: FormData) {
  "use server";
  const ticketId = String(formData.get("ticketId"));
  const stageKey = String(formData.get("stageKey")) as
    | "IN_PROGRESS"
    | "RESOLVED"
    | "CLOSED";
  const note = String(formData.get("note") || "") || undefined;
  await updateTicketStage(ticketId, stageKey, note);
}

const UW_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-100",
  IN_REVIEW: "bg-sky-50 text-sky-800 ring-sky-100",
  POLICY_READY: "bg-violet-50 text-violet-800 ring-violet-100",
  SENT: "bg-emerald-50 text-emerald-800 ring-emerald-100",
};

export default async function DepartmentQueuePage() {
  const session = await requireOrgSession();
  const orgId = session.organizationId;
  const departmentId = session.user.departmentId;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const weekStart = subDays(now, 6);

  if (!departmentId) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <h1 className="text-xl font-bold text-slate-900">Department portal</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your user is not linked to a department. Ask an admin to assign one in
          Settings → Users.
        </p>
      </div>
    );
  }

  const [department, orgModules] = await Promise.all([
    db.department.findFirst({
      where: { id: departmentId, organizationId: orgId },
    }),
    getOrgModules(orgId),
  ]);
  const isUnderwriting = department?.name === "Underwriting";
  const myModules = orgModules.filter(
    (m) => m.enabled && m.departmentId === departmentId
  );
  const myModuleCards = myModules
    .map((m) => MODULE_DEFS.find((d) => d.key === m.key))
    .filter(Boolean) as (typeof MODULE_DEFS)[number][];

  const [
    tickets,
    openCount,
    inProgressCount,
    resolvedMonth,
    ticketsThisWeek,
    ticketsPrevWeek,
    uwPending,
    uwReview,
    uwReady,
    uwSent,
    uwSentMonth,
    uwRecent,
    uwValuePending,
  ] = await Promise.all([
    db.ticket.findMany({
      where: { organizationId: orgId, departmentId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        stage: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
        assignee: { select: { name: true } },
        notes: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.ticket.count({
      where: {
        organizationId: orgId,
        departmentId,
        stage: { isTerminal: false },
      },
    }),
    db.ticket.count({
      where: {
        organizationId: orgId,
        departmentId,
        stage: { key: "IN_PROGRESS" },
      },
    }),
    db.ticket.count({
      where: {
        organizationId: orgId,
        departmentId,
        stage: { key: { in: ["RESOLVED", "CLOSED"] } },
        updatedAt: { gte: monthStart },
      },
    }),
    db.ticket.count({
      where: {
        organizationId: orgId,
        departmentId,
        createdAt: { gte: weekStart },
      },
    }),
    db.ticket.count({
      where: {
        organizationId: orgId,
        departmentId,
        createdAt: { gte: subDays(now, 13), lt: weekStart },
      },
    }),
    isUnderwriting
      ? db.order.count({
          where: { organizationId: orgId, underwritingStatus: "PENDING" },
        })
      : Promise.resolve(0),
    isUnderwriting
      ? db.order.count({
          where: { organizationId: orgId, underwritingStatus: "IN_REVIEW" },
        })
      : Promise.resolve(0),
    isUnderwriting
      ? db.order.count({
          where: { organizationId: orgId, underwritingStatus: "POLICY_READY" },
        })
      : Promise.resolve(0),
    isUnderwriting
      ? db.order.count({
          where: { organizationId: orgId, underwritingStatus: "SENT" },
        })
      : Promise.resolve(0),
    isUnderwriting
      ? db.order.count({
          where: {
            organizationId: orgId,
            underwritingStatus: "SENT",
            policySentAt: { gte: monthStart },
          },
        })
      : Promise.resolve(0),
    isUnderwriting
      ? db.order.findMany({
          where: { organizationId: orgId },
          orderBy: [{ underwritingStatus: "asc" }, { createdAt: "desc" }],
          take: 8,
          include: {
            customer: {
              select: { id: true, name: true, email: true, phone: true },
            },
            items: { select: { name: true }, take: 1 },
            attachments: {
              where: { label: { startsWith: "Policy —" } },
              select: { id: true },
              take: 1,
            },
          },
        })
      : Promise.resolve([]),
    isUnderwriting
      ? db.order.aggregate({
          where: {
            organizationId: orgId,
            underwritingStatus: { in: ["PENDING", "IN_REVIEW", "POLICY_READY"] },
          },
          _sum: { total: true },
          _count: true,
        })
      : Promise.resolve({ _sum: { total: null }, _count: 0 }),
  ]);

  const totalTickets = tickets.length;
  const weekChange =
    ticketsPrevWeek === 0
      ? ticketsThisWeek > 0
        ? 100
        : 0
      : Math.round(
          ((ticketsThisWeek - ticketsPrevWeek) / ticketsPrevWeek) * 1000
        ) / 10;

  const throughput =
    ticketsThisWeek === 0
      ? 0
      : Math.round(
          (tickets.filter(
            (t) => t.stage.isTerminal && t.updatedAt >= weekStart
          ).length /
            Math.max(ticketsThisWeek, 1)) *
            1000
        ) / 10;

  const pipeline = isUnderwriting
    ? [
        { key: "PENDING", label: "Awaiting #", count: uwPending, color: "#f59e0b" },
        { key: "IN_REVIEW", label: "In review", count: uwReview, color: "#0ea5e9" },
        {
          key: "POLICY_READY",
          label: "Doc ready",
          count: uwReady,
          color: "#8b5cf6",
        },
        { key: "SENT", label: "Emailed", count: uwSent, color: "#10b981" },
      ]
    : [
        {
          key: "OPEN",
          label: "Open queue",
          count: openCount,
          color: "#f59e0b",
        },
        {
          key: "IN_PROGRESS",
          label: "In progress",
          count: inProgressCount,
          color: "#0ea5e9",
        },
        {
          key: "RESOLVED_MTD",
          label: "Resolved MTD",
          count: resolvedMonth,
          color: "#10b981",
        },
        {
          key: "WEEK",
          label: "New this week",
          count: ticketsThisWeek,
          color: "#ef1e1e",
        },
      ];

  const maxPipe = Math.max(...pipeline.map((p) => p.count), 1);
  const pendingValue = Number(uwValuePending._sum.total ?? 0);

  return (
    <div className="space-y-5">
      {/* Dreams-style header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            {isUnderwriting ? "Underwriting Dashboard" : "Department Dashboard"}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {(isUnderwriting ? ["U", "W", "P", "E"] : ["D", "Q", "T", "A"]).map(
                (letter, i) => (
                  <div
                    key={letter}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm"
                    style={{
                      backgroundColor: [
                        "#0ea5e9",
                        "#f59e0b",
                        "#8b5cf6",
                        "#ef1e1e",
                      ][i],
                      zIndex: 4 - i,
                    }}
                  >
                    {letter}
                  </div>
                )
              )}
            </div>
            <p className="text-sm text-slate-500">
              {department?.name} · {session.user.name}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
            {format(weekStart, "dd MMM yy")} – {format(now, "dd MMM yy")}
          </div>
          {myModuleCards.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm shadow-amber-600/25 hover:bg-amber-700"
            >
              <Shield className="h-3.5 w-3.5" />
              {m.label}
            </Link>
          ))}
          <Link
            href="/inbox"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Inbox"
          >
            <Inbox className="h-4 w-4" />
          </Link>
          <form>
            <button
              type="submit"
              formAction="/department"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {myModuleCards.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {myModuleCards.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition hover:border-[rgba(172,22,224,0.25)] hover:shadow-md"
            >
              <p className="text-sm font-semibold text-slate-900">{m.label}</p>
              <p className="mt-1 text-xs text-slate-500">{m.description}</p>
              <p className="mt-2 text-[11px] font-semibold text-[#8b10b8]">
                Open module →
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          No modules assigned to this department yet. Admin can enable modules
          and assign this department in Settings → Departments.
        </div>
      )}

      {/* Top KPI strip — Dreams style */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={isUnderwriting ? "Open UW cases" : "Open tickets"}
          value={String(isUnderwriting ? uwPending + uwReview + uwReady : openCount)}
          hint={isUnderwriting ? "Awaiting issue / email" : "Non-terminal"}
          icon={<ClipboardList className="h-4 w-4" />}
          accent="bg-amber-600 shadow-amber-600/25"
          change={weekChange}
        />
        <KpiCard
          label={isUnderwriting ? "Policies issued MTD" : "Resolved MTD"}
          value={String(isUnderwriting ? uwSentMonth : resolvedMonth)}
          hint={format(monthStart, "MMMM yyyy")}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="bg-emerald-600 shadow-emerald-600/25"
          valueClass="text-emerald-600"
        />
        <KpiCard
          label={isUnderwriting ? "Pipeline value" : "In progress"}
          value={
            isUnderwriting
              ? formatCurrency(pendingValue)
              : String(inProgressCount)
          }
          hint={
            isUnderwriting
              ? `${uwValuePending._count} cases in flight`
              : "Actively worked"
          }
          icon={
            isUnderwriting ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <Timer className="h-4 w-4" />
            )
          }
          accent="bg-sky-600 shadow-sky-600/25"
          valueClass="text-sky-600"
        />
        <KpiCard
          label={isUnderwriting ? "Emailed total" : "Throughput"}
          value={isUnderwriting ? String(uwSent) : `${throughput}%`}
          hint={
            isUnderwriting ? "Policy docs sent" : "Resolved vs new (7d)"
          }
          icon={
            isUnderwriting ? (
              <MailCheck className="h-4 w-4" />
            ) : (
              <Ticket className="h-4 w-4" />
            )
          }
          accent="bg-[#ef1e1e] shadow-red-500/25"
          valueClass="text-[#ef1e1e]"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Pipeline overview */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">
                {isUnderwriting
                  ? "Underwriting Pipeline Overview"
                  : "Queue Pipeline Overview"}
              </h2>
            </div>
            <Link
              href={isUnderwriting ? "/underwriting" : "/tickets"}
              className="text-slate-400 hover:text-slate-600"
            >
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold tracking-tight text-slate-900">
                {isUnderwriting
                  ? formatCurrency(pendingValue)
                  : openCount + inProgressCount}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {isUnderwriting
                  ? "Value waiting on policy issue"
                  : "Active items in your department"}
              </p>
            </div>
            <ChangePill value={weekChange} />
          </div>

          <div className="mt-6 space-y-4">
            {pipeline.map((p) => (
              <div key={p.key}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{p.label}</span>
                  <span className="font-bold text-slate-900">{p.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.max((p.count / maxPipe) * 100, p.count ? 6 : 0)}%`,
                      backgroundColor: p.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Side stats */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-amber-600" />
              <h2 className="text-base font-semibold text-slate-900">
                {isUnderwriting ? "Issue rate" : "Conversion"}
              </h2>
            </div>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {isUnderwriting
                ? `${
                    uwPending + uwReview + uwReady + uwSent === 0
                      ? 0
                      : Math.round(
                          (uwSent /
                            (uwPending + uwReview + uwReady + uwSent)) *
                            1000
                        ) / 10
                  }%`
                : `${throughput}%`}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {isUnderwriting
                ? "Policies emailed vs all UW cases"
                : "Resolved vs new tickets (7 days)"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-sky-600" />
              <h2 className="text-base font-semibold text-slate-900">
                This week
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">New in</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {ticketsThisWeek}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">In queue</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {totalTickets}
                </p>
              </div>
            </div>
            {isUnderwriting ? (
              <Link
                href="/underwriting"
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 py-2.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <FileText className="h-3.5 w-3.5" />
                Process policies
              </Link>
            ) : (
              <Link
                href="/inbox"
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Inbox className="h-3.5 w-3.5" />
                Open email inbox
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Underwriting recent cases OR tickets table */}
      {isUnderwriting ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-amber-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Recent Underwriting Cases
              </h2>
            </div>
            <Link
              href="/underwriting"
              className="text-xs font-semibold text-amber-700 hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Sale / Customer</th>
                  <th className="px-3 py-3 font-semibold">Policy #</th>
                  <th className="px-3 py-3 font-semibold">Value</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {uwRecent.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-slate-50 transition hover:bg-slate-50/90"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900">
                        Order #{o.number}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {o.customer.name}
                        {o.items[0] ? ` · ${o.items[0].name}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs font-semibold text-slate-800">
                      {o.policyNumber || "—"}
                    </td>
                    <td className="px-3 py-3.5 font-semibold text-slate-900">
                      {formatCurrency(Number(o.total))}
                    </td>
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                          UW_STYLE[o.underwritingStatus] ||
                            "bg-slate-50 text-slate-600 ring-slate-100"
                        )}
                      >
                        {o.underwritingStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/underwriting/${o.id}`}
                        className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        Process
                      </Link>
                    </td>
                  </tr>
                ))}
                {uwRecent.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No underwriting cases yet — new sales appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Ticket worklist */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
            <h2 className="text-base font-semibold text-slate-900">
              {isUnderwriting ? "Linked department tickets" : "Recently forwarded"}
            </h2>
          </div>
          <p className="text-xs text-slate-400">{tickets.length} shown</p>
        </div>

        <div className="divide-y divide-slate-50">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 transition hover:bg-slate-50/80"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/tickets/${t.id}`}
                    className="font-semibold text-slate-900 hover:text-[#ef1e1e]"
                  >
                    #{t.number} · {t.subject}
                  </Link>
                  <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-100">
                    {t.stage.name}
                  </span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                      t.priority === "URGENT" || t.priority === "HIGH"
                        ? "bg-rose-50 text-rose-700 ring-rose-100"
                        : "bg-slate-50 text-slate-600 ring-slate-100"
                    )}
                  >
                    {t.priority}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                  {t.description}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  <Link
                    href={`/customers/${t.customer.id}`}
                    className="text-[#8b10b8] hover:underline"
                  >
                    {t.customer.name}
                  </Link>
                  {t.customer.phone ? ` · ${t.customer.phone}` : ""} ·{" "}
                  {formatDateTime(t.updatedAt)}
                  {t.assignee?.name ? ` · ${t.assignee.name}` : ""}
                </p>
                {t.notes[0] ? (
                  <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                    Note: {t.notes[0].body}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {!t.stage.isTerminal ? (
                  <>
                    <form action={setStageAction}>
                      <input type="hidden" name="ticketId" value={t.id} />
                      <input type="hidden" name="stageKey" value="IN_PROGRESS" />
                      <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        className="h-8 bg-white text-xs"
                      >
                        Start
                      </Button>
                    </form>
                    <form
                      action={setStageAction}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="ticketId" value={t.id} />
                      <input type="hidden" name="stageKey" value="RESOLVED" />
                      <Textarea
                        name="note"
                        rows={1}
                        placeholder="Note"
                        className="min-h-[32px] min-w-[140px] py-1.5 text-xs"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 bg-[#ef1e1e] text-xs text-white hover:bg-[#d41919]"
                      >
                        Resolve
                      </Button>
                    </form>
                  </>
                ) : null}
                <Link href={`/tickets/${t.id}`}>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 bg-slate-100 text-xs"
                  >
                    Open
                  </Button>
                </Link>
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <div className="px-5 py-14 text-center text-sm text-slate-500">
              No tickets forwarded to this department yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChangePill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      {up ? "+" : ""}
      {value}% vs prior week
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent,
  valueClass,
  change,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent: string;
  valueClass?: string;
  change?: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-bold text-slate-900",
              valueClass
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
          {typeof change === "number" ? (
            <div className="mt-2">
              <ChangePill value={change} />
            </div>
          ) : null}
        </div>
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md",
            accent
          )}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
