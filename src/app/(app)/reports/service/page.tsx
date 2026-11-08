import Link from "next/link";
import {
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
  startOfYear,
  subDays,
} from "date-fns";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageSquare,
  Phone,
  Ticket,
  Timer,
  Users,
} from "lucide-react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";
import { CsvDownloadButton } from "@/components/reports/csv-download-button";
import {
  ChannelMixChart,
  InboxVolumeChart,
  PipelineChart,
  PriorityBarsChart,
  VolumeTrendChart,
} from "@/components/reports/service-charts";

type Props = {
  searchParams: Promise<{ range?: string }>;
};

const RANGES = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "ytd", label: "YTD", days: null },
  { id: "all", label: "All time", days: null },
] as const;

function channelLabel(channel: string) {
  if (channel === "WHATSAPP") return "WhatsApp";
  if (channel === "WALK_IN") return "Walk-in";
  return channel.charAt(0) + channel.slice(1).toLowerCase().replace("_", " ");
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / (1000 * 60))}m`;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

export default async function ServiceReportsPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const orgId = session.organizationId;
  const params = await searchParams;
  const rangeId = RANGES.some((r) => r.id === params.range)
    ? (params.range as (typeof RANGES)[number]["id"])
    : "30d";

  const now = new Date();
  const rangeEnd = endOfDay(now);
  let rangeStart: Date | null = startOfDay(subDays(now, 29));
  if (rangeId === "7d") rangeStart = startOfDay(subDays(now, 6));
  else if (rangeId === "30d") rangeStart = startOfDay(subDays(now, 29));
  else if (rangeId === "90d") rangeStart = startOfDay(subDays(now, 89));
  else if (rangeId === "ytd") rangeStart = startOfYear(now);
  else if (rangeId === "all") rangeStart = null;

  const ticketCreatedWhere: Prisma.TicketWhereInput = {
    organizationId: orgId,
    ...(rangeStart ? { createdAt: { gte: rangeStart, lte: rangeEnd } } : {}),
  };

  const ticketResolvedWhere: Prisma.TicketWhereInput = {
    organizationId: orgId,
    resolvedAt: rangeStart
      ? { gte: rangeStart, lte: rangeEnd }
      : { not: null },
  };

  const [
    stages,
    types,
    users,
    byStage,
    byType,
    byChannel,
    byPriority,
    byAssignee,
    createdInRange,
    resolvedTickets,
    openCount,
    totalTickets,
    unassignedOpen,
    urgentOpen,
    slaBreached,
    csatAgg,
    byOmniChannel,
    messageCount,
    openConversations,
    callCount,
    recentTickets,
  ] = await Promise.all([
    db.ticketStage.findMany({
      where: { organizationId: orgId },
      orderBy: { position: "asc" },
    }),
    db.ticketType.findMany({ where: { organizationId: orgId } }),
    db.user.findMany({
      where: { organizationId: orgId, active: true },
      select: { id: true, name: true },
    }),
    db.ticket.groupBy({
      by: ["stageId"],
      where: { organizationId: orgId },
      _count: true,
    }),
    db.ticket.groupBy({
      by: ["typeId"],
      where: ticketCreatedWhere,
      _count: true,
    }),
    db.ticket.groupBy({
      by: ["channel"],
      where: ticketCreatedWhere,
      _count: true,
    }),
    db.ticket.groupBy({
      by: ["priority"],
      where: ticketCreatedWhere,
      _count: true,
    }),
    db.ticket.groupBy({
      by: ["assigneeId"],
      where: ticketCreatedWhere,
      _count: true,
    }),
    db.ticket.findMany({
      where: ticketCreatedWhere,
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.ticket.findMany({
      where: ticketResolvedWhere,
      select: { createdAt: true, resolvedAt: true, assigneeId: true },
    }),
    db.ticket.count({
      where: {
        organizationId: orgId,
        stage: { isTerminal: false },
      },
    }),
    db.ticket.count({ where: { organizationId: orgId } }),
    db.ticket.count({
      where: {
        organizationId: orgId,
        assigneeId: null,
        stage: { isTerminal: false },
      },
    }),
    db.ticket.count({
      where: {
        organizationId: orgId,
        priority: { in: ["HIGH", "URGENT"] },
        stage: { isTerminal: false },
      },
    }),
    db.slaTimer.count({
      where: {
        OR: [{ firstBreached: true }, { resolveBreached: true }],
        ticket: {
          organizationId: orgId,
          ...(rangeStart
            ? { createdAt: { gte: rangeStart, lte: rangeEnd } }
            : {}),
        },
      },
    }),
    db.csatResponse.aggregate({
      where: {
        ticket: {
          organizationId: orgId,
          ...(rangeStart
            ? { createdAt: { gte: rangeStart, lte: rangeEnd } }
            : {}),
        },
      },
      _avg: { rating: true },
      _count: true,
    }),
    db.conversation.groupBy({
      by: ["channel"],
      where: { organizationId: orgId },
      _count: true,
      _sum: { unreadCount: true },
    }),
    db.message.count({
      where: {
        conversation: { organizationId: orgId },
        ...(rangeStart
          ? { sentAt: { gte: rangeStart, lte: rangeEnd } }
          : {}),
      },
    }),
    db.conversation.count({
      where: { organizationId: orgId, status: { not: "CLOSED" } },
    }),
    db.callLog.count({
      where: {
        organizationId: orgId,
        ...(rangeStart
          ? { startedAt: { gte: rangeStart, lte: rangeEnd } }
          : {}),
      },
    }),
    db.ticket.findMany({
      where: ticketCreatedWhere,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        stage: true,
        customer: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    }),
  ]);

  const stageCount = Object.fromEntries(
    byStage.map((r) => [r.stageId, r._count])
  ) as Record<string, number>;

  const pipelineData = stages.map((s) => ({
    name: s.name,
    count: stageCount[s.id] || 0,
    color: s.color || "#ac16e0",
    key: s.key,
    isTerminal: s.isTerminal,
  }));

  const typeMap = new Map(types.map((t) => [t.id, t.name]));

  const typeRows = byType
    .map((r) => ({
      type: r.typeId ? typeMap.get(r.typeId) || "Unknown" : "Untyped",
      count: r._count,
    }))
    .sort((a, b) => b.count - a.count);

  const channelRows = byChannel
    .map((r) => ({
      name: channelLabel(r.channel),
      value: r._count,
    }))
    .sort((a, b) => b.value - a.value);

  const priorityOrder = ["URGENT", "HIGH", "MEDIUM", "LOW"];
  const priorityRows = priorityOrder.map((name) => ({
    name,
    count: byPriority.find((p) => p.priority === name)?._count || 0,
  }));

  const createdInRangeCount = createdInRange.length;
  const resolvedCount = resolvedTickets.length;
  const resolutionRate =
    createdInRangeCount === 0
      ? 0
      : Math.round((resolvedCount / createdInRangeCount) * 1000) / 10;

  const avgResolveMs =
    resolvedTickets.length === 0
      ? 0
      : resolvedTickets.reduce((sum, t) => {
          if (!t.resolvedAt) return sum;
          return sum + (t.resolvedAt.getTime() - t.createdAt.getTime());
        }, 0) / resolvedTickets.length;

  const csatAvg = csatAgg._avg.rating
    ? Math.round(csatAgg._avg.rating * 10) / 10
    : null;

  // Trend buckets
  const trendStart =
    rangeStart ||
    (createdInRange[0]
      ? startOfDay(createdInRange[0].createdAt)
      : startOfDay(subDays(now, 29)));
  const days = eachDayOfInterval({
    start: trendStart,
    end: rangeEnd,
  });
  // Cap very long "all" ranges to last 120 days for chart readability
  const chartDays =
    days.length > 120 ? days.slice(days.length - 120) : days;
  const chartStart = chartDays[0] || trendStart;

  const createdByDay = new Map<string, number>();
  const resolvedByDay = new Map<string, number>();
  for (const t of createdInRange) {
    if (t.createdAt < chartStart) continue;
    const key = format(t.createdAt, "yyyy-MM-dd");
    createdByDay.set(key, (createdByDay.get(key) || 0) + 1);
  }
  for (const t of resolvedTickets) {
    if (!t.resolvedAt || t.resolvedAt < chartStart) continue;
    const key = format(t.resolvedAt, "yyyy-MM-dd");
    resolvedByDay.set(key, (resolvedByDay.get(key) || 0) + 1);
  }

  const trendData = chartDays.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return {
      label: format(d, chartDays.length > 45 ? "MMM d" : "MMM d"),
      created: createdByDay.get(key) || 0,
      resolved: resolvedByDay.get(key) || 0,
    };
  });

  // Agent leaderboard
  const resolvedByAgent = new Map<string, number>();
  for (const t of resolvedTickets) {
    if (!t.assigneeId) continue;
    resolvedByAgent.set(
      t.assigneeId,
      (resolvedByAgent.get(t.assigneeId) || 0) + 1
    );
  }
  const agentRows = users
    .map((u) => {
      const assigned =
        byAssignee.find((a) => a.assigneeId === u.id)?._count || 0;
      const resolved = resolvedByAgent.get(u.id) || 0;
      return { id: u.id, name: u.name, assigned, resolved };
    })
    .filter((r) => r.assigned > 0 || r.resolved > 0)
    .sort((a, b) => b.resolved - a.resolved || b.assigned - a.assigned)
    .slice(0, 8);

  const unassignedCreated =
    byAssignee.find((a) => a.assigneeId === null)?._count || 0;

  const omniRows = byOmniChannel.map((r) => ({
    name: channelLabel(r.channel),
    conversations: r._count,
    unread: r._sum.unreadCount || 0,
  }));

  const csvRows = [
    ...pipelineData.map((r) => ({
      metric: "pipeline_stage",
      name: r.name,
      count: r.count,
    })),
    ...typeRows.map((r) => ({ metric: "type", name: r.type, count: r.count })),
    ...channelRows.map((r) => ({
      metric: "ticket_channel",
      name: r.name,
      count: r.value,
    })),
    ...priorityRows.map((r) => ({
      metric: "priority",
      name: r.name,
      count: r.count,
    })),
    ...agentRows.map((r) => ({
      metric: "agent_resolved",
      name: r.name,
      count: r.resolved,
    })),
    ...omniRows.map((r) => ({
      metric: "inbox_channel",
      name: r.name,
      count: r.conversations,
    })),
  ];

  const rangeLabel =
    RANGES.find((r) => r.id === rangeId)?.label || "30 days";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Service reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pipeline, volume & agent performance · {rangeLabel.toLowerCase()}
            {rangeStart
              ? ` · ${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {RANGES.map((r) => (
              <Link
                key={r.id}
                href={`/reports/service?range=${r.id}`}
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
          <CsvDownloadButton
            filename={`service-report-${rangeId}.csv`}
            rows={csvRows}
          />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Created</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {createdInRangeCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {totalTickets} all-time · {openCount} open now
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ac16e0] text-white shadow-md shadow-[0_10px_24px_-12px_rgba(172,22,224,0.35)]">
              <Ticket className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Resolved</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {resolvedCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {resolutionRate}% vs created · avg {formatDuration(avgResolveMs)}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Urgent / high open</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{urgentOpen}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {unassignedOpen} unassigned open
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">SLA breaches</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {slaBreached}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                CSAT {csatAvg != null ? `${csatAvg}/5` : "—"} · {csatAgg._count}{" "}
                ratings
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Timer className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <Inbox className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Open inbox threads</p>
            <p className="text-lg font-bold text-slate-900">{openConversations}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <MessageSquare className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Messages in range</p>
            <p className="text-lg font-bold text-slate-900">{messageCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <Phone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Calls logged</p>
            <p className="text-lg font-bold text-slate-900">{callCount}</p>
          </div>
        </div>
      </div>

      {/* Pipeline + trend */}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Ticket pipeline
                </h2>
                <p className="text-[11px] text-slate-400">
                  Live queue by stage (current snapshot)
                </p>
              </div>
            </div>
            <Link
              href="/tickets"
              className="text-xs font-medium text-[#8b10b8] hover:underline"
            >
              Open board
            </Link>
          </div>
          <div className="px-3 pb-4 pt-2">
            {pipelineData.some((d) => d.count > 0) ? (
              <PipelineChart data={pipelineData} height={320} />
            ) : (
              <EmptyChart label="No tickets in pipeline yet" />
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-50 px-5 py-3">
            {pipelineData.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
                <span className="text-slate-400">{s.count}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Volume trend
                </h2>
                <p className="text-[11px] text-slate-400">
                  Created vs resolved over time
                </p>
              </div>
            </div>
            <Activity className="h-4 w-4 text-slate-300" />
          </div>
          <div className="px-3 pb-4 pt-2">
            {trendData.some((d) => d.created || d.resolved) ? (
              <VolumeTrendChart data={trendData} height={320} />
            ) : (
              <EmptyChart label="No ticket activity in this range" />
            )}
          </div>
        </div>
      </div>

      {/* Channel + priority + inbox */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Channel mix
            </h2>
            <p className="text-[11px] text-slate-400">Tickets created by channel</p>
          </div>
          <div className="px-2 py-3">
            {channelRows.length ? (
              <ChannelMixChart data={channelRows} height={250} />
            ) : (
              <EmptyChart label="No channel data" />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">Priority</h2>
            <p className="text-[11px] text-slate-400">Created tickets by priority</p>
          </div>
          <div className="px-3 py-3">
            {priorityRows.some((p) => p.count > 0) ? (
              <PriorityBarsChart data={priorityRows} height={250} />
            ) : (
              <EmptyChart label="No priority data" />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Inbox volume
            </h2>
            <p className="text-[11px] text-slate-400">
              Omnichannel threads & unread
            </p>
          </div>
          <div className="px-3 py-3">
            {omniRows.length ? (
              <InboxVolumeChart data={omniRows} height={250} />
            ) : (
              <EmptyChart label="No inbox data" />
            )}
          </div>
        </div>
      </div>

      {/* Agents + types + recent */}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:col-span-1">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Users className="h-4 w-4 text-[#8b10b8]" />
            <h2 className="text-base font-semibold text-slate-900">
              Agent performance
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {agentRows.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(172,22,224,0.08)] text-[11px] font-bold text-[#8b10b8]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {a.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {a.assigned} assigned in range
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">
                    {a.resolved}
                  </p>
                  <p className="text-[10px] text-slate-400">resolved</p>
                </div>
              </div>
            ))}
            {agentRows.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No agent activity in this range
              </p>
            )}
            {unassignedCreated > 0 && (
              <div className="flex items-center justify-between bg-amber-50/50 px-5 py-3">
                <p className="text-xs font-medium text-amber-800">
                  Unassigned on create
                </p>
                <p className="text-sm font-bold text-amber-700">
                  {unassignedCreated}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:col-span-1">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              By complaint type
            </h2>
            <p className="text-[11px] text-slate-400">Created in selected range</p>
          </div>
          <div className="space-y-2.5 p-5">
            {typeRows.slice(0, 8).map((r) => {
              const max = typeRows[0]?.count || 1;
              const pct = Math.round((r.count / max) * 100);
              return (
                <div key={r.type}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{r.type}</span>
                    <span className="font-semibold text-slate-900">{r.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#ac16e0]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {typeRows.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No typed tickets yet
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent tickets
              </h2>
              <p className="text-[11px] text-slate-400">Latest in this range</p>
            </div>
            <Clock3 className="h-4 w-4 text-slate-300" />
          </div>
          <div className="divide-y divide-slate-50">
            {recentTickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="block px-5 py-3 transition hover:bg-slate-50/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                    <span className="text-slate-400">#{t.number}</span> {t.subject}
                  </p>
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100"
                    style={{
                      backgroundColor: `${t.stage.color}18`,
                    }}
                  >
                    {t.stage.name}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {t.customer.name}
                  {t.assignee?.name ? ` · ${t.assignee.name}` : " · Unassigned"}
                  {" · "}
                  {formatDate(t.createdAt)}
                </p>
              </Link>
            ))}
            {recentTickets.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No tickets in this range
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Activity className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}
