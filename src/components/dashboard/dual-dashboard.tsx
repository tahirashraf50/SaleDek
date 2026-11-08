"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Headphones,
  PhoneIncoming,
  Ticket,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  SalesCrmDashboard,
  type SalesCrmData,
} from "@/components/dashboard/sales-crm-dashboard";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import {
  DashboardDateRange,
  type DashboardRangeId,
} from "@/components/dashboard/dashboard-date-range";

type DashTab = "both" | "sales" | "service";

function ChangePill({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

export type DualDashboardProps = {
  orgName: string;
  dateLabel: string;
  initialView?: "both" | "sales" | "service";
  dateRange: {
    rangeId: DashboardRangeId;
    from: string;
    to: string;
    label: string;
  };
  sales: SalesCrmData;
  service: {
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    escalatedTickets: number;
    inboxUnread: number;
    openThreads: number;
    callsToday: number;
    callsMonth: number;
    callsPrevMonth: number;
    recentCalls: {
      id: string;
      phone: string;
      callerName: string | null;
      reason: string | null;
      outcome: string;
      startedAt: Date | string;
      agentName: string | null;
    }[];
    recentTickets: {
      id: string;
      number: number;
      subject: string;
      customerId: string;
      customerName: string;
      stageName: string;
      stageKey: string;
      createdAt: Date | string;
    }[];
    ticketsByChannel: { label: string; count: number; color: string }[];
  };
};

function stageBadgeColor(key: string) {
  if (key === "RESOLVED" || key === "CLOSED") return "green" as const;
  if (key === "ESCALATED") return "red" as const;
  if (key === "IN_PROGRESS") return "teal" as const;
  if (key === "NEW") return "blue" as const;
  return "default" as const;
}

export function DualDashboard(props: DualDashboardProps) {
  const initial = props.initialView ?? "both";
  const [tab, setTab] = useState<DashTab>(initial);
  const [pending, startTransition] = useTransition();
  // Mount a tab once visited; hide inactive with display:none (no layout cost)
  const [seen, setSeen] = useState<Record<DashTab, boolean>>({
    both: true,
    sales: initial === "sales",
    service: initial === "service",
  });

  function selectTab(next: DashTab) {
    if (next === tab) return;
    startTransition(() => {
      setSeen((s) => (s[next] ? s : { ...s, [next]: true }));
      setTab(next);
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {props.orgName}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <DashboardDateRange
            rangeId={props.dateRange.rangeId}
            from={props.dateRange.from}
            to={props.dateRange.to}
            label={props.dateRange.label}
            view={tab}
          />
          <div
            className={cn(
              "inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm",
              pending && "opacity-80"
            )}
          >
            {(
              [
                { id: "both", label: "Both", active: "bg-slate-800 text-white" },
                {
                  id: "sales",
                  label: "Sales",
                  active: "bg-[#ef1e1e] text-white shadow-sm shadow-red-500/30",
                },
                {
                  id: "service",
                  label: "Call center",
                  active: "bg-sky-700 text-white",
                },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tab === t.id ? t.active : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        {seen.both ? (
          <div
            className={cn(
              "grid gap-4 xl:grid-cols-2",
              tab !== "both" && "hidden"
            )}
            aria-hidden={tab !== "both"}
          >
            <SalesPreview sales={props.sales} />
            <ServicePane service={props.service} />
          </div>
        ) : null}
        {seen.sales ? (
          <div className={cn(tab !== "sales" && "hidden")} aria-hidden={tab !== "sales"}>
            <SalesCrmDashboard data={props.sales} hideTitle />
          </div>
        ) : null}
        {seen.service ? (
          <div
            className={cn(tab !== "service" && "hidden")}
            aria-hidden={tab !== "service"}
          >
            <ServicePane service={props.service} solo />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Compact sales preview when Both is selected */
function SalesPreview({ sales }: { sales: SalesCrmData }) {
  const chart = sales.charts.weekly;
  const totals = sales.totals.weekly;
  const maxPipe = Math.max(...sales.pipeline.map((p) => p.value), 1);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-[#f7f8f9] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
          <h2 className="text-sm font-semibold text-slate-900">Sales</h2>
        </div>
        <span className="text-[11px] text-slate-400">Open Sales tab for full view</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <p className="text-xs text-slate-500">Revenue</p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {formatCurrency(totals.revenue)}
          </p>
          <ChangePill value={sales.revenueChange} />
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
          <p className="text-xs text-slate-500">Active deals</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{sales.activeDeals}</p>
          <ChangePill value={sales.dealsChange} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
        <RevenueChart data={chart} height={200} />
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-3.5 w-1 rounded-sm bg-[#ef1e1e]" />
          <h3 className="text-sm font-semibold">Pipeline</h3>
        </div>
        <div className="space-y-2">
          {sales.pipeline.slice(0, 4).map((p) => (
            <div key={p.id}>
              <div className="mb-0.5 flex justify-between text-[11px]">
                <span className="text-slate-600">{p.name}</span>
                <span className="text-slate-500">{p.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
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
        </div>
      </div>
    </section>
  );
}

function ServicePane({
  service,
  solo,
}: {
  service: DualDashboardProps["service"];
  solo?: boolean;
}) {
  const callsChange = (() => {
    if (service.callsPrevMonth === 0) return service.callsMonth > 0 ? 100 : 0;
    return (
      Math.round(
        ((service.callsMonth - service.callsPrevMonth) / service.callsPrevMonth) *
          1000
      ) / 10
    );
  })();
  const maxCh = Math.max(...service.ticketsByChannel.map((c) => c.count), 1);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-700 text-white">
            <Headphones className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Call center &amp; complaints
            </h2>
            <p className="text-[11px] text-slate-500">Tickets, inbox & incoming calls</p>
          </div>
        </div>
        <Link href="/tickets" className="text-xs font-medium text-sky-700 hover:underline">
          Tickets →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-sky-800">
            <PhoneIncoming className="h-3.5 w-3.5" /> Calls today
          </div>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {service.callsToday}
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500">Calls this month</p>
            <ChangePill value={callsChange} />
          </div>
          <p className="mt-1 text-3xl font-semibold text-slate-900">
            {service.callsMonth}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Prev month: {service.callsPrevMonth}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open tickets" value={service.openTickets} href="/tickets" />
        <Stat
          label="In progress"
          value={service.inProgressTickets}
          href="/tickets?stage=IN_PROGRESS"
        />
        <Stat
          label="Resolved"
          value={service.resolvedTickets}
          href="/tickets?stage=RESOLVED"
        />
        <Stat label="Escalated" value={service.escalatedTickets} href="/tickets" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            <Ticket className="h-3.5 w-3.5" /> Inbox unread
          </div>
          <p className="text-2xl font-semibold text-slate-900">
            {service.inboxUnread}
          </p>
          <Link href="/inbox" className="mt-1 text-[11px] font-medium text-[#8b10b8]">
            {service.openThreads} open threads →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tickets by channel
          </p>
          <div className="space-y-2">
            {service.ticketsByChannel.map((c) => (
              <div key={c.label}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span className="text-slate-600">{c.label}</span>
                  <span className="font-semibold text-slate-800">{c.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(6, (c.count / maxCh) * 100)}%`,
                      backgroundColor: c.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`grid gap-3 ${solo ? "lg:grid-cols-2" : ""}`}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Recent calls</h3>
            <Link href="/inbox" className="text-[11px] font-medium text-sky-700">
              Log call
            </Link>
          </div>
          <ul className="divide-y divide-slate-50">
            {service.recentCalls.map((c) => (
              <li key={c.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {c.callerName || c.phone}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {c.phone}
                      {c.reason ? ` · ${c.reason}` : ""}
                    </p>
                  </div>
                  <Badge color="blue">{c.outcome}</Badge>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  {formatDateTime(c.startedAt)}
                  {c.agentName ? ` · ${c.agentName}` : ""}
                </p>
              </li>
            ))}
            {service.recentCalls.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-slate-400">
                No calls logged yet.
              </li>
            )}
          </ul>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Recent complaints</h3>
            <Link href="/tickets" className="text-[11px] font-medium text-sky-700">
              View all
            </Link>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {service.recentTickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-slate-50 hover:bg-slate-50/80"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="font-semibold text-[#8b10b8] hover:underline"
                    >
                      #{t.number}
                    </Link>
                  </td>
                  <td className="max-w-[120px] truncate px-1 py-2.5 text-slate-700">
                    {t.subject}
                  </td>
                  <td className="px-1 py-2.5">{t.customerName}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Badge color={stageBadgeColor(t.stageKey)}>{t.stageName}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {service.recentTickets.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-slate-400">
              No tickets yet.
            </p>
          )}
        </div>
      </div>

      {!solo && service.recentTickets[0] && (
        <p className="text-center text-[10px] text-slate-400">
          Last ticket · {formatDate(service.recentTickets[0].createdAt)}
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-sky-200"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
