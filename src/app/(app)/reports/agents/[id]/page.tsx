import Link from "next/link";
import { notFound } from "next/navigation";
import {
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
  startOfYear,
  subDays,
} from "date-fns";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Settings2,
  ShoppingCart,
  Ticket,
} from "lucide-react";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  PriorityBarsChart,
  VolumeTrendChart,
} from "@/components/reports/service-charts";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; tab?: string }>;
};

const RANGES = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "All time" },
] as const;

const AVATAR = ["#ac16e0", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"];

function roleLabel(role: string) {
  return role
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

function roleBadge(role: Role) {
  if (role === "ORG_ADMIN" || role === "SUPER_ADMIN") return "red" as const;
  if (role === "MANAGER") return "violet" as const;
  if (role === "AGENT") return "teal" as const;
  if (role === "DEPARTMENT_USER") return "blue" as const;
  return "default" as const;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / (1000 * 60))}m`;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash + id.charCodeAt(i) * 17) % AVATAR.length;
  return AVATAR[hash];
}

function isSupportDept(name?: string | null) {
  if (!name) return false;
  const n = name.toLowerCase();
  return (
    n.includes("customer support") ||
    n.includes("support") ||
    n.includes("call center") ||
    n.includes("contact center") ||
    n === "cs"
  );
}

export default async function AgentReportDetailPage({
  params,
  searchParams,
}: Props) {
  const session = await requireOrgSession();
  const { id } = await params;
  const sp = await searchParams;
  const rangeId = RANGES.some((r) => r.id === sp.range)
    ? (sp.range as (typeof RANGES)[number]["id"])
    : "30d";
  const agentsTab = sp.tab === "departments" ? "departments" : "support";

  const now = new Date();
  const rangeEnd = endOfDay(now);
  let rangeStart: Date | null = startOfDay(subDays(now, 29));
  if (rangeId === "7d") rangeStart = startOfDay(subDays(now, 6));
  else if (rangeId === "30d") rangeStart = startOfDay(subDays(now, 29));
  else if (rangeId === "90d") rangeStart = startOfDay(subDays(now, 89));
  else if (rangeId === "ytd") rangeStart = startOfYear(now);
  else if (rangeId === "all") rangeStart = null;

  const user = await db.user.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      department: { select: { id: true, name: true } },
    },
  });
  if (!user) notFound();

  const ticketAssignedWhere = {
    organizationId: session.organizationId,
    assigneeId: user.id,
    ...(rangeStart ? { createdAt: { gte: rangeStart, lte: rangeEnd } } : {}),
  };

  const orderCreatedWhere = {
    organizationId: session.organizationId,
    createdById: user.id,
    ...(rangeStart ? { createdAt: { gte: rangeStart, lte: rangeEnd } } : {}),
  };

  const paymentConfirmedWhere = {
    confirmedById: user.id,
    status: { in: ["PAID", "CLEARED", "RECEIVED"] as const },
    ...(rangeStart
      ? { OR: [{ paidAt: { gte: rangeStart, lte: rangeEnd } }, { paidAt: null, createdAt: { gte: rangeStart, lte: rangeEnd } }] }
      : {}),
  };

  const [
    assignedOpen,
    assignedInRange,
    resolvedInRange,
    ticketsByPriority,
    ordersCreated,
    ordersValueAgg,
    paidOrdersAgg,
    paymentsConfirmedAgg,
    conversationsAssigned,
    messagesSent,
    callsLogged,
    notesWorked,
    recentTickets,
    recentOrders,
    recentConfirmedPayments,
    resolvedTicketsForAvg,
  ] = await Promise.all([
    db.ticket.count({
      where: {
        organizationId: session.organizationId,
        assigneeId: user.id,
        stage: { isTerminal: false },
      },
    }),
    db.ticket.count({ where: ticketAssignedWhere }),
    db.ticket.count({
      where: {
        organizationId: session.organizationId,
        assigneeId: user.id,
        resolvedAt: rangeStart
          ? { gte: rangeStart, lte: rangeEnd }
          : { not: null },
      },
    }),
    db.ticket.groupBy({
      by: ["priority"],
      where: ticketAssignedWhere,
      _count: true,
    }),
    db.order.count({ where: orderCreatedWhere }),
    db.order.aggregate({
      where: orderCreatedWhere,
      _sum: { total: true },
    }),
    db.order.aggregate({
      where: {
        organizationId: session.organizationId,
        createdById: user.id,
        paymentStatus: { in: ["PAID", "CLEARED"] },
        ...(rangeStart ? { createdAt: { gte: rangeStart, lte: rangeEnd } } : {}),
      },
      _sum: { total: true },
      _count: true,
    }),
    db.payment.aggregate({
      where: paymentConfirmedWhere,
      _sum: { amount: true },
      _count: true,
    }),
    db.conversation.count({
      where: {
        organizationId: session.organizationId,
        assigneeId: user.id,
        status: { not: "CLOSED" },
      },
    }),
    db.message.count({
      where: {
        authorUserId: user.id,
        direction: "OUT",
        ...(rangeStart ? { sentAt: { gte: rangeStart, lte: rangeEnd } } : {}),
        conversation: { organizationId: session.organizationId },
      },
    }),
    db.callLog.count({
      where: {
        organizationId: session.organizationId,
        agentId: user.id,
        ...(rangeStart
          ? { startedAt: { gte: rangeStart, lte: rangeEnd } }
          : {}),
      },
    }),
    db.ticketNote.count({
      where: {
        authorId: user.id,
        ...(rangeStart
          ? { createdAt: { gte: rangeStart, lte: rangeEnd } }
          : {}),
        ticket: { organizationId: session.organizationId },
      },
    }),
    db.ticket.findMany({
      where: {
        organizationId: session.organizationId,
        assigneeId: user.id,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: {
        stage: true,
        customer: { select: { name: true } },
      },
    }),
    db.order.findMany({
      where: orderCreatedWhere,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        customer: { select: { name: true } },
      },
    }),
    db.payment.findMany({
      where: paymentConfirmedWhere,
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        order: {
          select: {
            id: true,
            number: true,
            customer: { select: { name: true } },
          },
        },
      },
    }),
    db.ticket.findMany({
      where: {
        organizationId: session.organizationId,
        assigneeId: user.id,
        resolvedAt: rangeStart
          ? { gte: rangeStart, lte: rangeEnd }
          : { not: null },
      },
      select: { createdAt: true, resolvedAt: true },
      take: 500,
    }),
  ]);

  const assignedCreated = await db.ticket.findMany({
    where: ticketAssignedWhere,
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const trendStart =
    rangeStart ||
    (assignedCreated[0]
      ? startOfDay(assignedCreated[0].createdAt)
      : startOfDay(subDays(now, 29)));
  const days = eachDayOfInterval({ start: trendStart, end: rangeEnd });
  const chartDays = days.length > 90 ? days.slice(days.length - 90) : days;
  const chartStart = chartDays[0] || trendStart;

  const createdByDay = new Map<string, number>();
  const resolvedByDay = new Map<string, number>();
  for (const t of assignedCreated) {
    if (t.createdAt < chartStart) continue;
    const key = format(t.createdAt, "yyyy-MM-dd");
    createdByDay.set(key, (createdByDay.get(key) || 0) + 1);
  }
  for (const t of resolvedTicketsForAvg) {
    if (!t.resolvedAt || t.resolvedAt < chartStart) continue;
    const key = format(t.resolvedAt, "yyyy-MM-dd");
    resolvedByDay.set(key, (resolvedByDay.get(key) || 0) + 1);
  }
  const trendData = chartDays.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return {
      label: format(d, "MMM d"),
      created: createdByDay.get(key) || 0,
      resolved: resolvedByDay.get(key) || 0,
    };
  });

  const priorityOrder = ["URGENT", "HIGH", "MEDIUM", "LOW"];
  const priorityRows = priorityOrder.map((name) => ({
    name,
    count: ticketsByPriority.find((p) => p.priority === name)?._count || 0,
  }));

  const avgResolveMs =
    resolvedTicketsForAvg.length === 0
      ? 0
      : resolvedTicketsForAvg.reduce((sum, t) => {
          if (!t.resolvedAt) return sum;
          return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
        }, 0) / resolvedTicketsForAvg.length;

  const paidRevenue = Number(paidOrdersAgg._sum.total || 0);
  const orderValue = Number(ordersValueAgg._sum.total || 0);
  const confirmedAmount = Number(paymentsConfirmedAgg._sum.amount || 0);
  const confirmedCount = paymentsConfirmedAgg._count;
  const resolveRate =
    assignedInRange === 0
      ? 0
      : Math.round((resolvedInRange / assignedInRange) * 1000) / 10;

  const rangeLabel =
    RANGES.find((r) => r.id === rangeId)?.label || "30 days";
  // Support tab / no-dept admins still get support-style ticket KPIs
  const isSupport =
    isSupportDept(user.department?.name) ||
    (!user.departmentId && agentsTab === "support");
  const hasSales = ordersCreated > 0 || confirmedCount > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/reports/agents?range=${rangeId}&tab=${agentsTab}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#8b10b8] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to agent reports
        </Link>
        <Link
          href={`/settings/users/${user.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage profile
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-br from-[#f6f3fb]/70 to-white px-5 py-5">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md"
              style={{ backgroundColor: colorForId(user.id) }}
            >
              {initials(user.name)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {user.name}
                </h1>
                <Badge color={roleBadge(user.role)}>
                  {roleLabel(user.role)}
                </Badge>
                {!user.active ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    Login off
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </span>
                {user.department?.name ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {user.department.name}
                  </span>
                ) : null}
                <span>Joined {formatDate(user.createdAt)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {hasSales
              ? "Tickets & sales performance"
              : isSupport
                ? "Support process performance"
                : "Ticket work performance"}
          </h2>
          <p className="text-sm text-slate-500">
            {isSupport
              ? "Inbox, calls, tickets"
              : `${user.department?.name || "Department"} tickets`}
            {hasSales ? " · orders created & payments confirmed" : ""}
            {" · "}
            {rangeLabel.toLowerCase()}
            {rangeStart
              ? ` · ${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {RANGES.map((r) => (
            <Link
              key={r.id}
              href={`/reports/agents/${user.id}?range=${r.id}&tab=${agentsTab}`}
              scroll={false}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                rangeId === r.id
                  ? "bg-[#ac16e0] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Tickets assigned</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {assignedInRange}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {assignedOpen} open now
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ac16e0] text-white">
              <Ticket className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">
                {isSupport ? "Resolved" : "Tickets fixed"}
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {resolvedInRange}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {resolveRate}% rate · avg {formatDuration(avgResolveMs)}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
        </div>
        {isSupport ? (
          <>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Outbound messages</p>
                  <p className="mt-1 text-2xl font-bold text-sky-600">
                    {messagesSent}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {conversationsAssigned} open inbox threads
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                  <MessageSquare className="h-4 w-4" />
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Calls logged</p>
                  <p className="mt-1 text-2xl font-bold text-amber-600">
                    {callsLogged}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Support call intake
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Phone className="h-4 w-4" />
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Work notes</p>
                  <p className="mt-1 text-2xl font-bold text-violet-700">
                    {notesWorked}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Updates on tickets worked
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                  <Inbox className="h-4 w-4" />
                </span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">Open queue</p>
                  <p className="mt-1 text-2xl font-bold text-amber-600">
                    {assignedOpen}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Still assigned to this agent
                  </p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Clock3 className="h-4 w-4" />
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {isSupport ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <Inbox className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-slate-500">Open conversations</p>
              <p className="text-lg font-bold text-slate-900">
                {conversationsAssigned}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-600">
              <Phone className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-slate-500">Calls logged</p>
              <p className="text-lg font-bold text-slate-900">{callsLogged}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sales — always shown when agent has orders / confirmations */}
      <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-50 bg-gradient-to-r from-rose-50/80 to-white px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ef1e1e] text-white">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Sales performance
              </h3>
              <p className="text-[11px] text-slate-400">
                Orders created by this ID · payments confirmed by this ID
              </p>
            </div>
          </div>
          <Link
            href="/reports/sales"
            className="text-xs font-semibold text-[#ef1e1e] hover:underline"
          >
            Sales report →
          </Link>
        </div>
        <div className="grid gap-px bg-rose-50/80 sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Orders created
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {ordersCreated}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {formatCurrency(orderValue)} order value
            </p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Paid / cleared
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {formatCurrency(paidRevenue)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {paidOrdersAgg._count} paid orders
            </p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Payments confirmed
            </p>
            <p className="mt-1 text-2xl font-bold text-[#ef1e1e]">
              {formatCurrency(confirmedAmount)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {confirmedCount} confirmations
            </p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Pending pipeline
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-600">
              {formatCurrency(Math.max(0, orderValue - paidRevenue))}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              Created but not fully paid
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                Ticket volume
              </h3>
              <p className="text-[11px] text-slate-400">
                Assigned created vs resolved
              </p>
            </div>
            <div className="px-3 py-3">
              {trendData.some((d) => d.created || d.resolved) ? (
                <VolumeTrendChart data={trendData} height={280} />
              ) : (
                <p className="py-16 text-center text-sm text-slate-400">
                  No ticket activity in this range
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Priority mix
                </h3>
                <p className="text-[11px] text-slate-400">
                  Assigned tickets by priority
                </p>
              </div>
              <div className="px-3 py-3">
                {priorityRows.some((p) => p.count > 0) ? (
                  <PriorityBarsChart data={priorityRows} height={220} />
                ) : (
                  <p className="py-14 text-center text-sm text-slate-400">
                    No priority data
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Recent tickets
                  </h3>
                  <p className="text-[11px] text-slate-400">Latest assigned</p>
                </div>
                <Clock3 className="h-4 w-4 text-slate-300" />
              </div>
              <div className="divide-y divide-slate-50">
                {recentTickets.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tickets/${t.id}`}
                    className="block px-5 py-3 hover:bg-slate-50/80"
                  >
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                      <span className="text-slate-400">#{t.number}</span>{" "}
                      {t.subject}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {t.customer.name} · {t.stage.name} ·{" "}
                      {formatDate(t.updatedAt)}
                    </p>
                  </Link>
                ))}
                {recentTickets.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">
                    No assigned tickets
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-rose-50 px-5 py-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Orders created
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    By this agent&apos;s ID · {rangeLabel.toLowerCase()}
                  </p>
                </div>
                <Link
                  href="/sales/orders"
                  className="text-xs font-medium text-[#ef1e1e] hover:underline"
                >
                  All orders
                </Link>
              </div>
              <div className="divide-y divide-slate-50">
                {recentOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/sales/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-rose-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        Order #{o.number}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {o.customer.name} · {o.paymentStatus} ·{" "}
                        {formatDateTime(o.createdAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-slate-900">
                      {formatCurrency(Number(o.total))}
                    </p>
                  </Link>
                ))}
                {recentOrders.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">
                    No orders created in this range
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-rose-50 px-5 py-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Payments confirmed
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Confirmed under this agent&apos;s ID
                  </p>
                </div>
                <ShoppingCart className="h-4 w-4 text-[#ef1e1e]" />
              </div>
              <div className="divide-y divide-slate-50">
                {recentConfirmedPayments.map((p) => (
                  <Link
                    key={p.id}
                    href={`/sales/orders/${p.order.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-rose-50/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        Order #{p.order.number}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {p.order.customer.name} · {p.status}
                        {p.paidAt ? ` · ${formatDateTime(p.paidAt)}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-emerald-600">
                      {formatCurrency(Number(p.amount))}
                    </p>
                  </Link>
                ))}
                {recentConfirmedPayments.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">
                    No payments confirmed in this range
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="h-fit overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:sticky xl:top-4">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Account snapshot
            </h3>
            <p className="text-[11px] text-slate-400">
              Role & access — edit in Settings
            </p>
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Role</span>
              <Badge color={roleBadge(user.role)}>
                {roleLabel(user.role)}
              </Badge>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Department</span>
              <span className="font-medium text-slate-900">
                {user.department?.name || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Login</span>
              <span
                className={cn(
                  "font-medium",
                  user.active ? "text-emerald-700" : "text-slate-500"
                )}
              >
                {user.active ? "Enabled" : "Disabled"}
              </span>
            </div>
            <Link
              href={`/settings/users/${user.id}`}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Open in Settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
