import {
  eachDayOfInterval,
  eachMonthOfInterval,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { resolveDashboardRange } from "@/lib/dashboard-range";
import { DualDashboard } from "@/components/dashboard/dual-dashboard";
import type { RevenuePoint } from "@/components/dashboard/revenue-chart";

type Props = {
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    view?: string;
  }>;
};

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: "#22c55e",
  EMAIL: "#3b82f6",
  PHONE: "#f59e0b",
  WEB: "#8b5cf6",
  SMS: "#64748b",
};

function buildDayChart(
  days: Date[],
  orders: { total: unknown; createdAt: Date }[],
  labelFmt = "EEE"
): RevenuePoint[] {
  const maxRev = Math.max(
    ...days.map((day) => {
      const key = format(day, "yyyy-MM-dd");
      return orders
        .filter((o) => format(o.createdAt, "yyyy-MM-dd") === key)
        .reduce((s, o) => s + Number(o.total), 0);
    }),
    1
  );
  return days.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const dayOrders = orders.filter(
      (o) => format(o.createdAt, "yyyy-MM-dd") === key
    );
    const revenue = dayOrders.reduce((s, o) => s + Number(o.total), 0);
    return {
      label: format(day, labelFmt),
      revenue,
      sales: dayOrders.length * (maxRev / 8),
    };
  });
}

function buildMonthChart(
  months: Date[],
  orders: { total: unknown; createdAt: Date }[]
): RevenuePoint[] {
  const maxRev = Math.max(
    ...months.map((m) => {
      const key = format(m, "yyyy-MM");
      return orders
        .filter((o) => format(o.createdAt, "yyyy-MM") === key)
        .reduce((s, o) => s + Number(o.total), 0);
    }),
    1
  );
  return months.map((m) => {
    const key = format(m, "yyyy-MM");
    const monthOrders = orders.filter(
      (o) => format(o.createdAt, "yyyy-MM") === key
    );
    const revenue = monthOrders.reduce((s, o) => s + Number(o.total), 0);
    return {
      label: format(m, "MMM"),
      revenue,
      sales: monthOrders.length * (maxRev / 8),
    };
  });
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const orgId = session.organizationId;
  const params = await searchParams;
  const now = new Date();
  const dashRange = resolveDashboardRange({
    range: params.range,
    from: params.from,
    to: params.to,
    now,
  });
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = dashRange.start;
  const rangeEnd = dashRange.end;
  const prevWeekStart = dashRange.prevStart;
  const prevWeekEnd = dashRange.prevEnd;
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));
  const last12Start = startOfMonth(subMonths(now, 11));
  const last6YearsStart = startOfYear(subYears(now, 5));
  const initialView =
    params.view === "sales" || params.view === "service" ? params.view : "both";

  const [
    org,
    paidWeek,
    paidPrevWeek,
    paidMonth,
    paidYear,
    paidLast12,
    paidMultiYear,
    allOrdersWeek,
    allOrdersPrevWeek,
    dealsActive,
    dealsActivePrev,
    dealStages,
    deals,
    pendingPayments,
    paidByCustomer,
    recentOrders,
    customersTotal,
    customersThisWeek,
    channelGroups,
    stages,
    ticketsByStage,
    ticketsByChannel,
    inboxUnread,
    openConversations,
    callsToday,
    callsMonth,
    callsPrevMonth,
    recentCalls,
    recentTickets,
  ] = await Promise.all([
    db.organization.findFirst({
      where: { id: orgId },
      select: { name: true },
    }),
    db.order.findMany({
      where: {
        organizationId: orgId,
        paymentStatus: "PAID",
        createdAt: { gte: weekStart, lte: rangeEnd },
      },
      select: { total: true, createdAt: true },
    }),
    db.order.aggregate({
      where: {
        organizationId: orgId,
        paymentStatus: "PAID",
        createdAt: { gte: prevWeekStart, lte: prevWeekEnd },
      },
      _sum: { total: true },
      _count: true,
    }),
    db.order.findMany({
      where: {
        organizationId: orgId,
        paymentStatus: "PAID",
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      select: { total: true, createdAt: true },
    }),
    db.order.findMany({
      where: {
        organizationId: orgId,
        paymentStatus: "PAID",
        createdAt: { gte: yearStart, lte: yearEnd },
      },
      select: { total: true, createdAt: true },
    }),
    db.order.findMany({
      where: {
        organizationId: orgId,
        paymentStatus: "PAID",
        createdAt: { gte: last12Start, lte: todayEnd },
      },
      select: { total: true, createdAt: true },
    }),
    db.order.findMany({
      where: {
        organizationId: orgId,
        paymentStatus: "PAID",
        createdAt: { gte: last6YearsStart, lte: todayEnd },
      },
      select: { total: true, createdAt: true },
    }),
    db.order.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: weekStart, lte: rangeEnd },
      },
    }),
    db.order.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: prevWeekStart, lte: prevWeekEnd },
      },
    }),
    db.deal.count({
      where: {
        organizationId: orgId,
        stage: { isWon: false, isLost: false },
      },
    }),
    db.deal.count({
      where: {
        organizationId: orgId,
        stage: { isWon: false, isLost: false },
        createdAt: { lte: prevWeekEnd },
      },
    }),
    db.dealStage.findMany({
      where: { organizationId: orgId },
      orderBy: { position: "asc" },
    }),
    db.deal.findMany({
      where: { organizationId: orgId },
      select: {
        value: true,
        stageId: true,
        stage: { select: { isWon: true, isLost: true } },
      },
    }),
    db.payment.count({
      where: {
        order: { organizationId: orgId },
        status: { in: ["PENDING", "RECEIVED"] },
      },
    }),
    db.order.groupBy({
      by: ["customerId"],
      where: { organizationId: orgId, paymentStatus: "PAID" },
      _sum: { total: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
    db.order.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { customer: { select: { name: true } } },
    }),
    db.customer.count({ where: { organizationId: orgId } }),
    db.customer.count({
      where: { organizationId: orgId, createdAt: { gte: weekStart } },
    }),
    db.conversation.groupBy({
      by: ["channel"],
      where: { organizationId: orgId, status: { not: "CLOSED" } },
      _count: true,
    }),
    db.ticketStage.findMany({ where: { organizationId: orgId } }),
    db.ticket.groupBy({
      by: ["stageId"],
      where: { organizationId: orgId },
      _count: true,
    }),
    db.ticket.groupBy({
      by: ["channel"],
      where: { organizationId: orgId },
      _count: true,
    }),
    db.conversation.aggregate({
      where: { organizationId: orgId },
      _sum: { unreadCount: true },
    }),
    db.conversation.count({
      where: { organizationId: orgId, status: { not: "CLOSED" } },
    }),
    db.callLog.count({
      where: {
        organizationId: orgId,
        startedAt: { gte: todayStart, lte: todayEnd },
      },
    }),
    db.callLog.count({
      where: {
        organizationId: orgId,
        startedAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    db.callLog.count({
      where: {
        organizationId: orgId,
        startedAt: { gte: prevMonthStart, lte: prevMonthEnd },
      },
    }),
    db.callLog.findMany({
      where: { organizationId: orgId },
      orderBy: { startedAt: "desc" },
      take: 6,
      include: { agent: { select: { name: true } } },
    }),
    db.ticket.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        stage: true,
        customer: { select: { id: true, name: true } },
      },
    }),
  ]);

  const rangeDayCount = differenceInCalendarDays(rangeEnd, weekStart) + 1;
  const weekDays = eachDayOfInterval({ start: weekStart, end: rangeEnd });
  const monthDays = eachDayOfInterval({
    start: startOfDay(subDays(now, 29)),
    end: todayEnd,
  });
  // For monthly tab show last 30 days by weekday-ish labels - use last 12 months for yearly feel on monthly
  const months12 = eachMonthOfInterval({ start: last12Start, end: monthStart });
  const years = eachMonthOfInterval({
    start: last6YearsStart,
    end: yearStart,
  }).filter((_, i, arr) => i % 12 === 0 || i === arr.length - 1);

  // Yearly chart: group by year from multi-year paid
  const yearKeys = Array.from(
    new Set(paidMultiYear.map((o) => format(o.createdAt, "yyyy")))
  ).sort();
  if (yearKeys.length === 0) yearKeys.push(format(now, "yyyy"));
  const maxYearRev = Math.max(
    ...yearKeys.map((y) =>
      paidMultiYear
        .filter((o) => format(o.createdAt, "yyyy") === y)
        .reduce((s, o) => s + Number(o.total), 0)
    ),
    1
  );
  const yearlyChart: RevenuePoint[] = yearKeys.map((y) => {
    const list = paidMultiYear.filter((o) => format(o.createdAt, "yyyy") === y);
    const revenue = list.reduce((s, o) => s + Number(o.total), 0);
    return {
      label: y,
      revenue,
      sales: list.length * (maxYearRev / 8),
    };
  });

  void monthDays;
  void years;
  void yearEnd;

  const dayLabelFmt = rangeDayCount <= 10 ? "EEE" : "d MMM";
  const weeklyChart =
    rangeDayCount > 62
      ? buildMonthChart(
          eachMonthOfInterval({
            start: startOfMonth(weekStart),
            end: startOfMonth(rangeEnd),
          }),
          paidWeek
        )
      : buildDayChart(weekDays, paidWeek, dayLabelFmt);
  const monthlyChart = buildMonthChart(months12, paidLast12);

  const weekRevenue = paidWeek.reduce((s, o) => s + Number(o.total), 0);
  const monthRevenue = paidMonth.reduce((s, o) => s + Number(o.total), 0);
  const yearRevenue = paidYear.reduce((s, o) => s + Number(o.total), 0);
  const prevRevenue = Number(paidPrevWeek._sum.total ?? 0);

  const conversionRate =
    allOrdersWeek === 0
      ? 0
      : Math.round((paidWeek.length / allOrdersWeek) * 1000) / 10;
  const prevPaidCount = paidPrevWeek._count || 0;
  const prevConversion =
    allOrdersPrevWeek === 0
      ? 0
      : Math.round((prevPaidCount / allOrdersPrevWeek) * 1000) / 10;

  const pipeline = dealStages.map((stage) => {
    const stageDeals = deals.filter((d) => d.stageId === stage.id);
    return {
      id: stage.id,
      name: stage.name,
      color: stage.color || "#ef1e1e",
      count: stageDeals.length,
      value: stageDeals.reduce((s, d) => s + Number(d.value), 0),
    };
  });

  const customerIds = paidByCustomer.map((r) => r.customerId);
  const customerRows =
    customerIds.length > 0
      ? await db.customer.findMany({
          where: { id: { in: customerIds }, organizationId: orgId },
          select: { id: true, name: true, city: true },
        })
      : [];
  const customerMap = new Map(customerRows.map((c) => [c.id, c]));
  const topCustomers = paidByCustomer
    .map((r) => {
      const c = customerMap.get(r.customerId);
      if (!c) return null;
      return {
        id: c.id,
        name: c.name,
        city: c.city,
        total: Number(r._sum.total ?? 0),
      };
    })
    .filter(Boolean) as {
    id: string;
    name: string;
    city: string | null;
    total: number;
  }[];

  const stageMap = new Map(stages.map((s) => [s.id, s]));
  let openTickets = 0;
  let inProgressTickets = 0;
  let resolvedTickets = 0;
  let escalatedTickets = 0;
  for (const row of ticketsByStage) {
    const stage = stageMap.get(row.stageId);
    if (!stage) continue;
    if (stage.key === "IN_PROGRESS") inProgressTickets += row._count;
    if (stage.key === "ESCALATED") escalatedTickets += row._count;
    if (stage.key === "RESOLVED" || stage.key === "CLOSED") {
      resolvedTickets += row._count;
    } else if (!stage.isTerminal) {
      openTickets += row._count;
    }
  }

  const traffic = channelGroups
    .map((g) => ({
      label: g.channel,
      count: g._count,
      color: CHANNEL_COLORS[g.channel] || "#ef1e1e",
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <DualDashboard
      orgName={org?.name || "Organization"}
      dateLabel={dashRange.label}
      initialView={initialView}
      dateRange={{
        rangeId: dashRange.rangeId,
        from: dashRange.from,
        to: dashRange.to,
        label: dashRange.label,
      }}
      sales={{
        dateLabel: dashRange.label,
        dateRange: {
          rangeId: dashRange.rangeId,
          from: dashRange.from,
          to: dashRange.to,
          label: dashRange.label,
        },
        charts: {
          weekly: weeklyChart,
          monthly: monthlyChart,
          yearly: yearlyChart,
        },
        totals: {
          weekly: { revenue: weekRevenue, sales: paidWeek.length },
          monthly: { revenue: monthRevenue, sales: paidMonth.length },
          yearly: { revenue: yearRevenue, sales: paidYear.length },
        },
        revenueChange: pctChange(weekRevenue, prevRevenue),
        activeDeals: dealsActive,
        dealsChange: pctChange(dealsActive, dealsActivePrev),
        conversionRate,
        conversionChange: pctChange(conversionRate, prevConversion),
        totalCustomers: customersTotal,
        customersThisWeek,
        pendingPayments,
        traffic,
        topCustomers,
        pipeline,
        dealsOverview: {
          won: deals.filter((d) => d.stage.isWon).length,
          open: deals.filter((d) => !d.stage.isWon && !d.stage.isLost).length,
          lost: deals.filter((d) => d.stage.isLost).length,
        },
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          number: o.number,
          customerName: o.customer.name,
          total: Number(o.total),
          paymentStatus: o.paymentStatus,
          createdAt: o.createdAt,
        })),
      }}
      service={{
        openTickets,
        inProgressTickets,
        resolvedTickets,
        escalatedTickets,
        inboxUnread: inboxUnread._sum.unreadCount || 0,
        openThreads: openConversations,
        callsToday,
        callsMonth,
        callsPrevMonth,
        recentCalls: recentCalls.map((c) => ({
          id: c.id,
          phone: c.phone,
          callerName: c.callerName,
          reason: c.reason,
          outcome: c.outcome,
          startedAt: c.startedAt,
          agentName: c.agent?.name || null,
        })),
        recentTickets: recentTickets.map((t) => ({
          id: t.id,
          number: t.number,
          subject: t.subject,
          customerId: t.customer.id,
          customerName: t.customer.name,
          stageName: t.stage.name,
          stageKey: t.stage.key,
          createdAt: t.createdAt,
        })),
        ticketsByChannel: ticketsByChannel
          .map((g) => ({
            label: g.channel,
            count: g._count,
            color: CHANNEL_COLORS[g.channel] || "#ac16e0",
          }))
          .sort((a, b) => b.count - a.count),
      }}
    />
  );
}
