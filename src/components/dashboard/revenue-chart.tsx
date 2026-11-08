"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

export type RevenuePoint = {
  label: string;
  revenue: number;
  sales: number;
};

/** Dreams CRMS-style: red bars + soft grey area */
export function RevenueChart({
  data,
  height = 280,
}: {
  data: RevenuePoint[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="crmsSalesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#e2e8f0" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#eef2f6" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(v) =>
              v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
            }
            width={48}
          />
          <Tooltip
            cursor={{ fill: "rgba(239,30,30,0.04)" }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #eef2f6",
              boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              formatCurrency(Number(value ?? 0)),
              name === "revenue" ? "Revenue" : "Sales",
            ]}
          />
          <Area
            type="monotone"
            dataKey="sales"
            fill="url(#crmsSalesFill)"
            stroke="#cbd5e1"
            strokeWidth={2}
          />
          <Bar
            dataKey="revenue"
            fill="#ef1e1e"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
