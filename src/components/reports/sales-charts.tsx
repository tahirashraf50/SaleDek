"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const RED = "#ef1e1e";
const SLATE = "#94a3b8";

const METHOD_COLORS: Record<string, string> = {
  BANK: "#3b82f6",
  JAZZCASH: "#ef1e1e",
  CHEQUE: "#f59e0b",
  INSTALLMENT: "#8b5cf6",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  PARTIAL: "#3b82f6",
  PAID: "#22c55e",
  CANCELLED: "#94a3b8",
  RECEIVED: "#38bdf8",
  CLEARED: "#10b981",
  BOUNCED: "#ef4444",
  OVERDUE: "#e11d48",
};

const MIX_COLORS = [
  "#ef1e1e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#22c55e",
  "#0d9488",
  "#64748b",
];

function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
  }>;
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs shadow-[0_10px_30px_rgba(15,23,42,0.1)]">
      {label ? <p className="mb-1 font-semibold text-slate-800">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-slate-600">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color || RED }}
          />
          <span>{p.name}:</span>
          <span className="font-semibold text-slate-900">
            {money ? formatCurrency(Number(p.value ?? 0)) : (p.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function RevenueTrendChart({
  data,
  height = 320,
}: {
  data: { label: string; revenue: number; orders: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesRevFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RED} stopOpacity={0.35} />
              <stop offset="100%" stopColor={RED} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="salesOrdFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: SLATE, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            yAxisId="rev"
            tickLine={false}
            axisLine={false}
            tick={{ fill: SLATE, fontSize: 11 }}
            width={52}
            tickFormatter={(v) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <YAxis
            yAxisId="ord"
            orientation="right"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: SLATE, fontSize: 11 }}
            width={28}
          />
          <Tooltip content={<ChartTooltip money />} />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            wrapperStyle={{ fontSize: 12, color: "#64748b" }}
          />
          <Area
            yAxisId="rev"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke={RED}
            strokeWidth={2.25}
            fill="url(#salesRevFill)"
          />
          <Area
            yAxisId="ord"
            type="monotone"
            dataKey="orders"
            name="Orders"
            stroke="#94a3b8"
            strokeWidth={2}
            fill="url(#salesOrdFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentMethodChart({
  data,
  height = 260,
}: {
  data: { name: string; value: number; key?: string }[];
  height?: number;
}) {
  const sum = data.reduce((s, d) => s + d.value, 0);
  const denom = sum || 1;
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="42%"
            cy="50%"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  (d.key && METHOD_COLORS[d.key]) ||
                  MIX_COLORS[i % MIX_COLORS.length]
                }
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip money />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            wrapperStyle={{ fontSize: 11, lineHeight: "18px" }}
            formatter={(value) => {
              const row = data.find((d) => d.name === value);
              const pct = row ? Math.round((row.value / denom) * 100) : 0;
              return `${value} (${pct}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute left-[28%] top-1/2 -translate-x-1/2 -translate-y-1/2 text-center sm:left-[32%]">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
          Revenue
        </p>
        <p className="max-w-[88px] truncate text-sm font-bold text-slate-900">
          {formatCurrency(sum)}
        </p>
      </div>
    </div>
  );
}

export function OrderStatusPipelineChart({
  data,
  height = 280,
}: {
  data: { name: string; count: number; value: number; key: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: SLATE, fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#475569", fontSize: 12 }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "rgba(239,30,30,0.04)" }}
          />
          <Bar dataKey="count" name="Orders" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {data.map((entry) => (
              <Cell
                key={entry.key}
                fill={STATUS_COLORS[entry.key] || RED}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentStatusChart({
  data,
  height = 240,
}: {
  data: { name: string; count: number; key: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: SLATE, fontSize: 11 }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: SLATE, fontSize: 11 }}
            width={28}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15,23,42,0.03)" }} />
          <Bar dataKey="count" name="Orders" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((entry) => (
              <Cell
                key={entry.key}
                fill={STATUS_COLORS[entry.key] || MIX_COLORS[0]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopProductsChart({
  data,
  height = 280,
}: {
  data: { name: string; revenue: number; qty: number }[];
  height?: number;
}) {
  const chartData = data.map((d) => ({
    ...d,
    short: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
  }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fill: SLATE, fontSize: 11 }}
            tickFormatter={(v) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
          />
          <YAxis
            type="category"
            dataKey="short"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#475569", fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip money />} />
          <Bar
            dataKey="revenue"
            name="Revenue"
            fill={RED}
            radius={[0, 6, 6, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
