"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

const TEAL = "#0d9488";
const RED = "#ef1e1e";
const SLATE = "#94a3b8";
const COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#ef1e1e", "#8b5cf6", "#22c55e"];

function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
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
            style={{ backgroundColor: p.color || TEAL }}
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

export function AgentLeaderboardChart({
  data,
  dataKey = "value",
  nameKey = "name",
  money = false,
  color = TEAL,
  height = 300,
}: {
  data: Array<Record<string, string | number>>;
  dataKey?: string;
  nameKey?: string;
  money?: boolean;
  color?: string;
  height?: number;
}) {
  const chartData = data.map((d) => ({
    ...d,
    short:
      String(d[nameKey]).length > 14
        ? `${String(d[nameKey]).slice(0, 12)}…`
        : String(d[nameKey]),
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
              money
                ? v >= 1000
                  ? `${Math.round(Number(v) / 1000)}k`
                  : String(v)
                : String(v)
            }
          />
          <YAxis
            type="category"
            dataKey="short"
            width={100}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#475569", fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip money={money} />} />
          <Bar
            dataKey={dataKey}
            name={money ? "Revenue" : "Count"}
            radius={[0, 6, 6, 0]}
            maxBarSize={22}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={i === 0 ? color : COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { TEAL, RED };
