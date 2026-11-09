import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CreditCard,
  Hourglass,
  RefreshCw,
  ShieldAlert,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { cn, formatCurrency, formatDate, formatPlatformCurrency } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  TRIAL: "bg-amber-50 text-amber-800 ring-amber-100",
  SUSPENDED: "bg-rose-50 text-rose-800 ring-rose-100",
};

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  TRIAL: "bg-amber-500",
  SUSPENDED: "bg-rose-500",
};

const AVATAR = ["#0d9488", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b"];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function AdminHomePage() {
  await requireSuperAdmin();
  const now = new Date();
  const weekStart = subDays(now, 6);

  const [
    orgs,
    active,
    suspended,
    trial,
    users,
    tickets,
    plans,
    recentOrgs,
    planRows,
    newThisWeek,
  ] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { status: "ACTIVE" } }),
    db.organization.count({ where: { status: "SUSPENDED" } }),
    db.organization.count({ where: { status: "TRIAL" } }),
    db.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
    db.ticket.count(),
    db.saaSPlan.count({ where: { active: true } }),
    db.organization.findMany({
      include: {
        plan: { select: { name: true, priceMonthly: true } },
        _count: { select: { users: true, tickets: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.organization.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] }, planId: { not: null } },
      select: {
        status: true,
        plan: { select: { id: true, name: true, priceMonthly: true } },
      },
    }),
    db.organization.count({
      where: { createdAt: { gte: weekStart } },
    }),
  ]);

  const mrr = planRows
    .filter((o) => o.status === "ACTIVE" && o.plan)
    .reduce((sum, o) => sum + Number(o.plan!.priceMonthly), 0);

  const planMix = new Map<
    string,
    { name: string; count: number; revenue: number }
  >();
  for (const row of planRows) {
    if (!row.plan) continue;
    const cur = planMix.get(row.plan.id) || {
      name: row.plan.name,
      count: 0,
      revenue: 0,
    };
    cur.count += 1;
    if (row.status === "ACTIVE") {
      cur.revenue += Number(row.plan.priceMonthly);
    }
    planMix.set(row.plan.id, cur);
  }
  const planMixList = [...planMix.values()].sort((a, b) => b.count - a.count);
  const mixMax = Math.max(1, ...planMixList.map((p) => p.count));

  const kpis = [
    {
      label: "Tenants",
      value: orgs,
      hint: `${newThisWeek} new this week`,
      href: "/admin/orgs",
      icon: Building2,
      tone: "bg-teal-700 text-white shadow-teal-700/25",
      valueClass: "text-slate-900",
    },
    {
      label: "Active",
      value: active,
      hint: "Paying / live orgs",
      href: "/admin/orgs",
      icon: BadgeCheck,
      tone: "bg-emerald-100 text-emerald-700",
      valueClass: "text-emerald-600",
    },
    {
      label: "Trial",
      value: trial,
      hint: "Evaluating",
      href: "/admin/orgs",
      icon: Hourglass,
      tone: "bg-amber-100 text-amber-700",
      valueClass: "text-amber-600",
    },
    {
      label: "Suspended",
      value: suspended,
      hint: "Access blocked",
      href: "/admin/orgs",
      icon: ShieldAlert,
      tone: "bg-rose-100 text-rose-700",
      valueClass: "text-rose-600",
    },
    {
      label: "Est. MRR",
      value: formatPlatformCurrency(mrr),
      hint: "Active plan sum",
      href: "/admin/plans",
      icon: Wallet,
      tone: "bg-sky-100 text-sky-700",
      valueClass: "text-sky-700",
      raw: true,
    },
    {
      label: "Tenant users",
      value: users,
      hint: "Excl. platform admins",
      icon: Users,
      tone: "bg-violet-100 text-violet-700",
      valueClass: "text-violet-600",
    },
    {
      label: "Tickets (all)",
      value: tickets,
      hint: "Across tenants",
      icon: Ticket,
      tone: "bg-slate-100 text-slate-700",
      valueClass: "text-slate-800",
    },
    {
      label: "Active plans",
      value: plans,
      hint: "On pricing page",
      href: "/admin/plans",
      icon: CreditCard,
      tone: "bg-teal-100 text-teal-700",
      valueClass: "text-teal-700",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Platform overview
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {["T", "A", "P", "S"].map((letter, i) => (
                <div
                  key={letter}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm"
                  style={{
                    backgroundColor: ["#0d9488", "#10b981", "#0ea5e9", "#f59e0b"][
                      i
                    ],
                    zIndex: 4 - i,
                  }}
                >
                  {letter}
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500">
              {orgs} tenants · {formatPlatformCurrency(mrr)} MRR · manage SaaS health
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
            {format(weekStart, "dd MMM yy")} – {format(now, "dd MMM yy")}
          </div>
          <Link
            href="/admin"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Link>
          <Link
            href="/admin/orgs"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 text-xs font-semibold text-white shadow-sm shadow-teal-700/20 hover:bg-teal-800"
          >
            All tenants
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const inner = (
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{k.label}</p>
                <p className={cn("mt-1 text-2xl font-bold", k.valueClass)}>
                  {k.value}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">{k.hint}</p>
              </div>
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full shadow-sm",
                  k.tone
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
          );
          return (
            <div
              key={k.label}
              className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
            >
              {k.href ? (
                <Link href={k.href} className="block hover:opacity-95">
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_340px]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-teal-600" />
              <Building2 className="h-4 w-4 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">
                Recent tenants
              </h2>
            </div>
            <Link
              href="/admin/orgs"
              className="text-[11px] font-semibold text-teal-700 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {recentOrgs.map((o, i) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50/90"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: AVATAR[i % AVATAR.length] }}
                >
                  {initials(o.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/orgs/${o.id}`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {o.name}
                    </Link>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                        STATUS_STYLE[o.status]
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          STATUS_DOT[o.status]
                        )}
                      />
                      {o.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {o.slug}
                    {" · "}
                    {o.plan?.name || "No plan"}
                    {o.plan
                      ? ` · ${formatPlatformCurrency(Number(o.plan.priceMonthly))}/mo`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {formatDate(o.createdAt)} · {o._count.users} users ·{" "}
                    {o._count.tickets} tickets
                  </p>
                </div>
                <Link
                  href={`/admin/orgs/${o.id}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
            {recentOrgs.length === 0 && (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <Building2 className="h-6 w-6" />
                </div>
                <p className="font-semibold text-slate-800">No tenants yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  New signups will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-br from-teal-50/80 to-transparent px-5 py-4">
              <CreditCard className="h-4 w-4 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Plan mix
              </h2>
            </div>
            <div className="space-y-3 p-5">
              {planMixList.map((p) => (
                <div key={p.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="text-slate-500">
                      {p.count} · {formatPlatformCurrency(p.revenue)} MRR
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-600"
                      style={{ width: `${(p.count / mixMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {planMixList.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No assigned plans yet.
                </p>
              ) : null}
              <Link
                href="/admin/plans"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
              >
                Manage plans
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-900 p-5 text-white shadow-[0_4px_20px_rgba(15,23,42,0.2)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200/80">
              Quick actions
            </p>
            <p className="mt-2 text-sm text-slate-200">
              Suspend risky tenants, tweak pricing, or open the public site.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/admin/orgs"
                className="inline-flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Review tenants
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/admin/plans"
                className="inline-flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Edit SaaS plans
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/admin/superusers"
                className="inline-flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Manage superusers
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/admin/website"
                className="inline-flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Website logo & footer
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-between rounded-xl bg-teal-500/20 px-3 py-2.5 text-xs font-semibold text-teal-50 ring-1 ring-teal-300/30 hover:bg-teal-500/30"
              >
                Public pricing page
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
