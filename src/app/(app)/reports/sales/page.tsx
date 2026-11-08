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
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  Package,
  ShoppingCart,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { CsvDownloadButton } from "@/components/reports/csv-download-button";
import {
  OrderStatusPipelineChart,
  PaymentMethodChart,
  PaymentStatusChart,
  RevenueTrendChart,
  TopProductsChart,
} from "@/components/reports/sales-charts";

type Props = {
  searchParams: Promise<{ range?: string }>;
};

const RANGES = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "All time" },
] as const;

const PAID_STATUSES = ["PAID", "CLEARED"] as const;
const OPEN_PAYMENT = ["PENDING", "RECEIVED", "PARTIAL", "OVERDUE"] as const;

function methodLabel(method: string) {
  if (method === "JAZZCASH") return "JazzCash";
  if (method === "BANK") return "Bank";
  if (method === "CHEQUE") return "Cheque";
  if (method === "INSTALLMENT") return "Installment";
  return method;
}

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function SalesReportsPage({ searchParams }: Props) {
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

  const orderWhere: Prisma.OrderWhereInput = {
    organizationId: orgId,
    ...(rangeStart ? { createdAt: { gte: rangeStart, lte: rangeEnd } } : {}),
  };

  const paidWhere: Prisma.OrderWhereInput = {
    ...orderWhere,
    paymentStatus: { in: [...PAID_STATUSES] },
  };

  const [
    ordersInRange,
    paidAgg,
    openAgg,
    totalAll,
    byPaymentMethod,
    byOrderStatus,
    byPaymentStatus,
    byCreator,
    topProducts,
    overdueInstallments,
    installmentPending,
    recentOrders,
    users,
  ] = await Promise.all([
    db.order.findMany({
      where: orderWhere,
      select: {
        id: true,
        createdAt: true,
        total: true,
        paymentStatus: true,
        status: true,
        createdById: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.order.aggregate({
      where: paidWhere,
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    db.order.aggregate({
      where: {
        organizationId: orgId,
        paymentStatus: { in: [...OPEN_PAYMENT] },
        status: { not: "CANCELLED" },
      },
      _sum: { total: true },
      _count: true,
    }),
    db.order.count({ where: { organizationId: orgId } }),
    db.order.groupBy({
      by: ["paymentMethod"],
      where: paidWhere,
      _count: true,
      _sum: { total: true },
    }),
    db.order.groupBy({
      by: ["status"],
      where: orderWhere,
      _count: true,
      _sum: { total: true },
    }),
    db.order.groupBy({
      by: ["paymentStatus"],
      where: orderWhere,
      _count: true,
      _sum: { total: true },
    }),
    db.order.groupBy({
      by: ["createdById"],
      where: orderWhere,
      _count: true,
      _sum: { total: true },
    }),
    db.orderItem.groupBy({
      by: ["name"],
      where: {
        order: {
          organizationId: orgId,
          paymentStatus: { in: [...PAID_STATUSES] },
          ...(rangeStart
            ? { createdAt: { gte: rangeStart, lte: rangeEnd } }
            : {}),
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 8,
    }),
    db.installment.count({
      where: {
        status: "OVERDUE",
        order: { organizationId: orgId },
      },
    }),
    db.installment.count({
      where: {
        status: { in: ["PENDING", "OVERDUE"] },
        order: { organizationId: orgId },
      },
    }),
    db.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    db.user.findMany({
      where: { organizationId: orgId, active: true },
      select: { id: true, name: true },
    }),
  ]);

  const collected = Number(paidAgg._sum.total || 0);
  const paidCount = paidAgg._count;
  const aov = Number(paidAgg._avg.total || 0);
  const outstanding = Number(openAgg._sum.total || 0);
  const orderCount = ordersInRange.length;
  const conversionRate =
    orderCount === 0 ? 0 : Math.round((paidCount / orderCount) * 1000) / 10;

  // Trend
  const trendStart =
    rangeStart ||
    (ordersInRange[0]
      ? startOfDay(ordersInRange[0].createdAt)
      : startOfDay(subDays(now, 29)));
  const days = eachDayOfInterval({ start: trendStart, end: rangeEnd });
  const chartDays = days.length > 120 ? days.slice(days.length - 120) : days;
  const chartStart = chartDays[0] || trendStart;

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const o of ordersInRange) {
    if (o.createdAt < chartStart) continue;
    const key = format(o.createdAt, "yyyy-MM-dd");
    const cur = byDay.get(key) || { revenue: 0, orders: 0 };
    cur.orders += 1;
    if (PAID_STATUSES.includes(o.paymentStatus as (typeof PAID_STATUSES)[number])) {
      cur.revenue += Number(o.total);
    }
    byDay.set(key, cur);
  }

  const trendData = chartDays.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    const row = byDay.get(key) || { revenue: 0, orders: 0 };
    return {
      label: format(d, chartDays.length > 45 ? "MMM d" : "MMM d"),
      revenue: row.revenue,
      orders: row.orders,
    };
  });

  const methodRows = byPaymentMethod
    .map((r) => ({
      key: r.paymentMethod,
      name: methodLabel(r.paymentMethod),
      value: Number(r._sum.total || 0),
      count: r._count,
    }))
    .sort((a, b) => b.value - a.value);

  const statusOrder = ["PENDING", "PARTIAL", "PAID", "CANCELLED"];
  const statusPipeline = statusOrder.map((key) => {
    const row = byOrderStatus.find((r) => r.status === key);
    return {
      key,
      name: statusLabel(key),
      count: row?._count || 0,
      value: Number(row?._sum.total || 0),
    };
  });

  const paymentStatusOrder = [
    "PENDING",
    "RECEIVED",
    "PARTIAL",
    "PAID",
    "CLEARED",
    "OVERDUE",
    "BOUNCED",
  ];
  const paymentStatusRows = paymentStatusOrder
    .map((key) => {
      const row = byPaymentStatus.find((r) => r.paymentStatus === key);
      return {
        key,
        name: statusLabel(key),
        count: row?._count || 0,
      };
    })
    .filter((r) => r.count > 0);

  const productRows = topProducts.map((r) => ({
    name: r.name,
    qty: r._sum.quantity || 0,
    revenue: Number(r._sum.lineTotal || 0),
  }));

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const paidByAgent = new Map<string, number>();
  for (const o of ordersInRange) {
    if (!o.createdById) continue;
    if (
      !PAID_STATUSES.includes(
        o.paymentStatus as (typeof PAID_STATUSES)[number]
      )
    ) {
      continue;
    }
    paidByAgent.set(
      o.createdById,
      (paidByAgent.get(o.createdById) || 0) + Number(o.total)
    );
  }
  const agentRows = byCreator
    .filter((r) => r.createdById)
    .map((r) => ({
      id: r.createdById!,
      name: userMap.get(r.createdById!) || "Unknown",
      orders: r._count,
      revenue: Number(r._sum.total || 0),
      paid: paidByAgent.get(r.createdById!) || 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
    .slice(0, 12);

  const csvRows = [
    ...methodRows.map((r) => ({
      metric: "payment_method_revenue",
      name: r.name,
      count: r.count,
      amount: r.value,
    })),
    ...statusPipeline.map((r) => ({
      metric: "order_status",
      name: r.name,
      count: r.count,
      amount: r.value,
    })),
    ...paymentStatusRows.map((r) => ({
      metric: "payment_status",
      name: r.name,
      count: r.count,
      amount: 0,
    })),
    ...productRows.map((r) => ({
      metric: "top_product",
      name: r.name,
      count: r.qty,
      amount: r.revenue,
    })),
    ...agentRows.map((r) => ({
      metric: "agent_sales",
      name: r.name,
      count: r.orders,
      amount: r.revenue,
    })),
  ];

  const rangeLabel =
    RANGES.find((r) => r.id === rangeId)?.label || "30 days";

  function paymentColor(status: string) {
    if (status === "PAID" || status === "CLEARED") return "text-emerald-600";
    if (status === "OVERDUE" || status === "BOUNCED") return "text-rose-600";
    if (status === "PARTIAL" || status === "PENDING" || status === "RECEIVED")
      return "text-amber-600";
    return "text-slate-600";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Sales reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Revenue, payments & product mix · {rangeLabel.toLowerCase()}
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
                href={`/reports/sales?range=${r.id}`}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  rangeId === r.id
                    ? "bg-[#ef1e1e] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
          <CsvDownloadButton
            filename={`sales-report-${rangeId}.csv`}
            rows={csvRows}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Collected</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatCurrency(collected)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {paidCount} paid · AOV {formatCurrency(aov)}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1e1e] text-white shadow-md shadow-red-500/20">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Outstanding</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {formatCurrency(outstanding)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {openAgg._count} open orders (all-time)
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Clock3 className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Orders in range</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{orderCount}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {conversionRate}% paid rate · {totalAll} all-time
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <ShoppingCart className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Installments due</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">
                {overdueInstallments}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {installmentPending} pending / overdue plans
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Paid conversion</p>
            <p className="text-lg font-bold text-slate-900">{conversionRate}%</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Average order value</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(aov)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <Banknote className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-slate-500">Payment methods used</p>
            <p className="text-lg font-bold text-slate-900">{methodRows.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Revenue trend
                </h2>
                <p className="text-[11px] text-slate-400">
                  Paid revenue vs orders created
                </p>
              </div>
            </div>
            <Activity className="h-4 w-4 text-slate-300" />
          </div>
          <div className="px-3 pb-4 pt-2">
            {trendData.some((d) => d.revenue || d.orders) ? (
              <RevenueTrendChart data={trendData} height={320} />
            ) : (
              <EmptyChart label="No sales activity in this range" />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Order pipeline
                </h2>
                <p className="text-[11px] text-slate-400">
                  Orders by status in selected range
                </p>
              </div>
            </div>
            <Link
              href="/sales/orders"
              className="text-xs font-medium text-[#ef1e1e] hover:underline"
            >
              View orders
            </Link>
          </div>
          <div className="px-3 pb-4 pt-2">
            {statusPipeline.some((d) => d.count > 0) ? (
              <OrderStatusPipelineChart data={statusPipeline} height={320} />
            ) : (
              <EmptyChart label="No orders in pipeline yet" />
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-50 px-5 py-3">
            {statusPipeline.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100"
              >
                {s.name}
                <span className="text-slate-400">{s.count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Payment methods
            </h2>
            <p className="text-[11px] text-slate-400">
              Paid revenue mix in range
            </p>
          </div>
          <div className="px-2 py-3">
            {methodRows.length ? (
              <PaymentMethodChart data={methodRows} height={250} />
            ) : (
              <EmptyChart label="No paid revenue yet" />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Payment status
            </h2>
            <p className="text-[11px] text-slate-400">Orders by payment state</p>
          </div>
          <div className="px-3 py-3">
            {paymentStatusRows.length ? (
              <PaymentStatusChart data={paymentStatusRows} height={250} />
            ) : (
              <EmptyChart label="No payment data" />
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Top products
            </h2>
            <p className="text-[11px] text-slate-400">
              Revenue from paid orders
            </p>
          </div>
          <div className="px-2 py-3">
            {productRows.length ? (
              <TopProductsChart data={productRows} height={250} />
            ) : (
              <EmptyChart label="No product sales yet" />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#ef1e1e]" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Agent sales
                </h2>
                <p className="text-[11px] text-slate-400">
                  Click a name for full agent report
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {agentRows.map((a, i) => (
              <Link
                key={a.id}
                href={`/reports/agents/${a.id}?range=${rangeId}&tab=support`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-rose-50/40"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 text-[11px] font-bold text-[#ef1e1e]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 hover:text-[#ef1e1e]">
                      {a.name}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {a.orders} orders · paid {formatCurrency(a.paid)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {formatCurrency(a.revenue)}
                    </p>
                    <p className="text-[10px] text-slate-400">order value</p>
                  </div>
                  <UserRound className="h-3.5 w-3.5 text-slate-300" />
                </div>
              </Link>
            ))}
            {agentRows.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No agent sales in this range
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Package className="h-4 w-4 text-[#ef1e1e]" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Product breakdown
              </h2>
              <p className="text-[11px] text-slate-400">Qty & revenue</p>
            </div>
          </div>
          <div className="space-y-2.5 p-5">
            {productRows.map((r) => {
              const max = productRows[0]?.revenue || 1;
              const pct = Math.round((r.revenue / max) * 100);
              return (
                <div key={r.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-slate-700">
                      {r.name}
                    </span>
                    <span className="shrink-0 font-semibold text-slate-900">
                      {formatCurrency(r.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#ef1e1e]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {r.qty} sold
                  </p>
                </div>
              );
            })}
            {productRows.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No product lines yet
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Recent orders
              </h2>
              <p className="text-[11px] text-slate-400">Latest in this range</p>
            </div>
            <Clock3 className="h-4 w-4 text-slate-300" />
          </div>
          <div className="divide-y divide-slate-50">
            {recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/sales/orders/${o.id}`}
                className="block px-5 py-3 transition hover:bg-slate-50/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Order #{o.number}
                  </p>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-semibold",
                      paymentColor(o.paymentStatus)
                    )}
                  >
                    {o.paymentStatus}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {o.customer.name}
                  {o.createdBy?.name ? ` · ${o.createdBy.name}` : ""}
                  {" · "}
                  {o._count.items} items
                  {" · "}
                  {formatCurrency(Number(o.total))}
                  {" · "}
                  {formatDate(o.createdAt)}
                </p>
              </Link>
            ))}
            {recentOrders.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No orders in this range
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
