"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Download,
  Handshake,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  RevenueChart,
  type RevenuePoint,
} from "@/components/dashboard/revenue-chart";
import {
  DashboardDateRange,
  type DashboardRangeId,
} from "@/components/dashboard/dashboard-date-range";

export type SalesCrmData = {
  dateLabel: string;
  dateRange?: {
    rangeId: DashboardRangeId;
    from: string;
    to: string;
    label: string;
  };
  charts: {
    weekly: RevenuePoint[];
    monthly: RevenuePoint[];
    yearly: RevenuePoint[];
  };
  totals: {
    weekly: { revenue: number; sales: number };
    monthly: { revenue: number; sales: number };
    yearly: { revenue: number; sales: number };
  };
  revenueChange: number;
  activeDeals: number;
  dealsChange: number;
  conversionRate: number;
  conversionChange: number;
  totalCustomers: number;
  customersThisWeek: number;
  pendingPayments: number;
  traffic: { label: string; count: number; color: string }[];
  topCustomers: {
    id: string;
    name: string;
    city: string | null;
    total: number;
  }[];
  pipeline: {
    id: string;
    name: string;
    color: string;
    count: number;
    value: number;
  }[];
  dealsOverview: { won: number; open: number; lost: number };
  recentOrders: {
    id: string;
    number: number;
    customerName: string;
    total: number;
    paymentStatus: string;
    createdAt: Date | string;
  }[];
};

function Change({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        up ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      }`}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function compactMoney(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return formatCurrency(n);
}

export function SalesCrmDashboard({
  data,
  hideTitle,
}: {
  data: SalesCrmData;
  hideTitle?: boolean;
}) {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const chart = data.charts[period];
  const totals = data.totals[period];
  const trafficTotal = Math.max(
    data.traffic.reduce((s, t) => s + t.count, 0),
    1
  );
  const maxPipe = Math.max(...data.pipeline.map((p) => p.value), 1);

  const trafficPercents = useMemo(
    () =>
      data.traffic.map((t) => ({
        ...t,
        pct: Math.round((t.count / trafficTotal) * 100),
      })),
    [data.traffic, trafficTotal]
  );

  return (
    <div className="space-y-5">
      {/* Header — Dreams style */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {!hideTitle ? (
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
              Dashboard
            </h1>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {["T", "S", "C", "A"].map((letter, i) => (
                  <div
                    key={letter}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm"
                    style={{
                      backgroundColor: [
                        "#0ea5e9",
                        "#22c55e",
                        "#f59e0b",
                        "#8b5cf6",
                      ][i],
                      zIndex: 4 - i,
                    }}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ef1e1e] text-white shadow-sm shadow-red-500/30"
                aria-label="Add"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
            <p className="text-sm font-semibold text-slate-900">Sales CRM</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!hideTitle ? (
            data.dateRange ? (
              <DashboardDateRange
                rangeId={data.dateRange.rangeId}
                from={data.dateRange.from}
                to={data.dateRange.to}
                label={data.dateRange.label}
                view="sales"
                compact
              />
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
                {data.dateLabel}
              </div>
            )
          ) : null}
          <Link
            href="/reports/sales"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Reports"
          >
            <Download className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Revenue Analytics + Traffic */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">
                Revenue Analytics
              </h2>
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
              {(
                [
                  {
                    id: "weekly",
                    label: data.dateRange ? "Selected" : "Weekly",
                  },
                  { id: "monthly", label: "Monthly" },
                  { id: "yearly", label: "Yearly" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    period === p.id
                      ? "bg-[#ef1e1e] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold tracking-tight text-slate-900">
                {compactMoney(totals.revenue)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Revenue with Sales · {totals.sales} paid orders
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700"
              >
                <span className="h-2 w-2 rounded-full bg-[#ef1e1e]" /> Revenue
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500"
              >
                <span className="h-2 w-2 rounded-full bg-slate-300" /> Sales
              </button>
            </div>
          </div>

          <div className="mt-2">
            <RevenueChart data={chart} height={300} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">
                Traffic Sources
              </h2>
            </div>
            <Link href="/inbox" className="text-slate-400 hover:text-slate-600">
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Simple donut via conic-gradient */}
          <div className="mx-auto mb-5 flex h-36 w-36 items-center justify-center">
            <div
              className="relative h-full w-full rounded-full"
              style={{
                background:
                  trafficPercents.length > 0
                    ? `conic-gradient(${trafficPercents
                        .reduce<{ css: string; acc: number }>(
                          (state, t) => {
                            const next = state.acc + t.pct;
                            return {
                              acc: next,
                              css: `${state.css}${state.css ? ", " : ""}${t.color} ${state.acc}% ${next}%`,
                            };
                          },
                          { css: "", acc: 0 }
                        ).css}, #f1f5f9 0)`
                    : "#f1f5f9",
              }}
            >
              <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white">
                <span className="text-lg font-bold text-slate-900">
                  {trafficTotal}
                </span>
                <span className="text-[10px] text-slate-400">threads</span>
              </div>
            </div>
          </div>

          <ul className="divide-y divide-slate-100">
            {trafficPercents.map((t) => (
              <li
                key={t.label}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.label}
                </span>
                <span className="font-semibold text-slate-900">{t.count}</span>
              </li>
            ))}
            {trafficPercents.length === 0 && (
              <li className="py-6 text-center text-sm text-slate-400">
                No inbox traffic yet
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* KPI row — Dreams style white cards + circular icons */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Revenue</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatCurrency(totals.revenue)}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Change value={data.revenueChange} />
                <span className="text-[11px] text-slate-400">From last week</span>
              </div>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ef1e1e] text-white shadow-md shadow-red-500/25">
              <Wallet className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Active Deals</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {data.activeDeals}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Change value={data.dealsChange} />
                <span className="text-[11px] text-slate-400">From last week</span>
              </div>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-md shadow-blue-500/25">
              <Handshake className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Conversion Rate</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {data.conversionRate}%
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Change value={data.conversionChange} />
                <span className="text-[11px] text-slate-400">From last week</span>
              </div>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#22c55e] text-white shadow-md shadow-green-500/25">
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Total Contacts</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {data.totalCustomers}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">
            <span className="font-semibold text-[#ef1e1e]">
              +{data.customersThisWeek}
            </span>{" "}
            from last week
          </p>
          <div className="mt-3 flex -space-x-2">
            {["A", "B", "C", "D"].map((l, i) => (
              <div
                key={l}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                style={{
                  backgroundColor: ["#ef1e1e", "#3b82f6", "#22c55e", "#f59e0b"][i],
                }}
              >
                {l}
              </div>
            ))}
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-semibold text-slate-500">
              +{Math.max(0, data.customersThisWeek)}
            </div>
          </div>
        </div>
      </div>

      {/* Top deals + Pipeline */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">Top Deals</h2>
            </div>
            <span className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500">
              Last 30 Days
            </span>
          </div>
          <div className="space-y-3">
            {data.topCustomers.map((c, i) => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-slate-50"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{
                    backgroundColor: [
                      "#ef1e1e",
                      "#3b82f6",
                      "#22c55e",
                      "#f59e0b",
                      "#8b5cf6",
                    ][i % 5],
                  }}
                >
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.city || "—"}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-800">
                    {formatCurrency(c.total)}
                  </p>
                </div>
              </Link>
            ))}
            {data.topCustomers.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No paid customers yet
              </p>
            )}
          </div>
          <Link
            href="/customers"
            className="mt-4 flex items-center justify-center gap-1 rounded-xl bg-slate-50 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            View All <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">
                Pipeline Statistics
              </h2>
            </div>
            <Link
              href="/sales/deals"
              className="text-xs font-medium text-[#ef1e1e] hover:underline"
            >
              Board
            </Link>
          </div>
          <div className="space-y-3">
            {data.pipeline.map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{p.name}</span>
                  <span className="text-xs text-slate-500">
                    {formatCurrency(p.value)}
                    <span className="ml-1 text-slate-400">· {p.count} Deals</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, (p.value / maxPipe) * 100)}%`,
                      backgroundColor: p.color || "#ef1e1e",
                    }}
                  />
                </div>
              </div>
            ))}
            {data.pipeline.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No pipeline deals
              </p>
            )}
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Deals Overview
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-emerald-600">
                  {data.dealsOverview.won}
                </p>
                <p className="text-[10px] text-slate-400">Won</p>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800">
                  {data.dealsOverview.open}
                </p>
                <p className="text-[10px] text-slate-400">Pending</p>
              </div>
              <div>
                <p className="text-xl font-bold text-[#ef1e1e]">
                  {data.dealsOverview.lost}
                </p>
                <p className="text-[10px] text-slate-400">Lost</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent deals/orders table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
            <h2 className="text-base font-semibold text-slate-900">Recent Deals</h2>
          </div>
          <Link
            href="/sales/orders"
            className="text-xs font-medium text-[#ef1e1e] hover:underline"
          >
            View All
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Deal / Order</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Value</th>
                <th className="px-3 py-3 font-semibold">Payment</th>
                <th className="px-5 py-3 font-semibold">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-slate-50 hover:bg-slate-50/80"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/sales/orders/${o.id}`}
                      className="font-semibold text-slate-900 hover:text-[#ef1e1e]"
                    >
                      Order #{o.number}
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-slate-600">{o.customerName}</td>
                  <td className="px-3 py-3.5 font-semibold text-slate-900">
                    {formatCurrency(o.total)}
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge
                      color={o.paymentStatus === "PAID" ? "green" : "amber"}
                    >
                      {o.paymentStatus}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400">
                    {data.pendingPayments > 0 && o.paymentStatus !== "PAID"
                      ? "Yes"
                      : "—"}
                  </td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
