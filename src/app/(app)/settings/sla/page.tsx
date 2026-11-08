import Link from "next/link";
import {
  Clock3,
  Gauge,
  Plus,
  Search,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { TicketPriority } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  createSlaPolicy,
  setSlaPolicyActive,
} from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

async function createSlaAction(formData: FormData) {
  "use server";
  await createSlaPolicy({
    name: String(formData.get("name")),
    priority: String(formData.get("priority") || "") || undefined,
    ticketTypeId: String(formData.get("ticketTypeId") || "") || undefined,
    firstResponseMins: Number(formData.get("firstResponseMins")),
    resolveMins: Number(formData.get("resolveMins")),
  });
}

async function toggleSlaAction(formData: FormData) {
  "use server";
  await setSlaPolicyActive(
    String(formData.get("id")),
    formData.get("active") === "true"
  );
}

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const PRIORITY_STYLE: Record<string, string> = {
  LOW: "bg-slate-50 text-slate-600 ring-slate-100",
  MEDIUM: "bg-sky-50 text-sky-700 ring-sky-100",
  HIGH: "bg-amber-50 text-amber-700 ring-amber-100",
  URGENT: "bg-rose-50 text-rose-700 ring-rose-100",
};

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

export default async function SettingsSlaPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;

  const baseWhere = { organizationId: session.organizationId };

  const [
    policies,
    types,
    totalAll,
    activeCount,
    inactiveCount,
    openTimers,
    breachedTimers,
  ] = await Promise.all([
    db.slaPolicy.findMany({
      where: {
        ...baseWhere,
        ...(statusFilter === "active" ? { active: true } : {}),
        ...(statusFilter === "inactive" ? { active: false } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query } },
                {
                  ticketType: {
                    name: { contains: query },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        ticketType: { select: { name: true } },
        _count: { select: { timers: true } },
      },
    }),
    db.ticketType.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { name: "asc" },
    }),
    db.slaPolicy.count({ where: baseWhere }),
    db.slaPolicy.count({ where: { ...baseWhere, active: true } }),
    db.slaPolicy.count({ where: { ...baseWhere, active: false } }),
    db.slaTimer.count({
      where: {
        policy: { organizationId: session.organizationId },
        resolveMetAt: null,
        resolveBreached: false,
      },
    }),
    db.slaTimer.count({
      where: {
        policy: { organizationId: session.organizationId },
        OR: [{ firstBreached: true }, { resolveBreached: true }],
      },
    }),
  ]);

  function href(next: { q?: string; status?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const status = next.status !== undefined ? next.status : params.status;
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    const s = qs.toString();
    return s ? `/settings/sla?${s}` : "/settings/sla";
  }

  const statusChips = [
    { id: "", label: "All", count: totalAll },
    { id: "active", label: "Active", count: activeCount },
    { id: "inactive", label: "Inactive", count: inactiveCount },
  ];

  const avgResolve =
    policies.length > 0
      ? Math.round(
          policies.reduce((s, p) => s + p.resolveMins, 0) / policies.length
        )
      : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            SLA policies
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Response & resolve targets by priority · {policies.length}
            {query || statusFilter ? " matching" : " shown"}
            {totalAll !== policies.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <form action="/settings/sla" method="get" className="flex gap-2">
          {statusFilter ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="Search policies…"
              defaultValue={query || ""}
              className="h-10 w-64 border-slate-200 bg-white pl-9 shadow-sm sm:w-72"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10 bg-white">
            Search
          </Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Policies</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} active · {inactiveCount} off
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 text-white shadow-md shadow-amber-600/25">
              <Gauge className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Open timers</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{openTimers}</p>
          <p className="mt-1 text-[11px] text-slate-400">Tickets still on clock</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Breaches</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{breachedTimers}</p>
          <p className="mt-1 text-[11px] text-slate-400">First or resolve missed</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Avg resolve target</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">
            {avgResolve ? formatDuration(avgResolve) : "—"}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Across listed policies</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusChips.map((f) => {
          const active = (statusFilter || "") === f.id;
          return (
            <Link
              key={f.id || "all"}
              href={href({ status: active && f.id ? "" : f.id })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-amber-600 text-white shadow-sm shadow-amber-600/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {f.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-amber-600" />
              <h2 className="text-base font-semibold text-slate-900">
                All policies
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Matched by priority & ticket type
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Policy</th>
                  <th className="px-3 py-3 font-semibold">Scope</th>
                  <th className="px-3 py-3 font-semibold">Targets</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-slate-50 transition hover:bg-slate-50/90",
                      !p.active && "opacity-70"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                          <Timer className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {p._count.timers} timer
                            {p._count.timers === 1 ? "" : "s"} linked
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1",
                            p.priority
                              ? PRIORITY_STYLE[p.priority]
                              : "bg-slate-50 text-slate-500 ring-slate-100"
                          )}
                        >
                          {p.priority || "Any priority"}
                        </span>
                        <span className="inline-flex rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                          {p.ticketType?.name || "Any type"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="space-y-1">
                        <p className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <Clock3 className="h-3 w-3 text-sky-500" />
                          First{" "}
                          <span className="font-semibold text-slate-900">
                            {formatDuration(p.firstResponseMins)}
                          </span>
                        </p>
                        <p className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <ShieldAlert className="h-3 w-3 text-amber-500" />
                          Resolve{" "}
                          <span className="font-semibold text-slate-900">
                            {formatDuration(p.resolveMins)}
                          </span>
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {p.active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <form action={toggleSlaAction} className="inline">
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={p.active ? "false" : "true"}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="h-8 bg-white text-xs"
                        >
                          {p.active ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
                {policies.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Gauge className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-800">
                          No SLA policies found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Clear filters or create a policy on the right.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="h-fit overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:sticky xl:top-4">
          <div className="border-b border-slate-100 bg-gradient-to-br from-amber-50/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm shadow-amber-600/25">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  New SLA policy
                </h2>
                <p className="text-[11px] text-slate-500">
                  First response & resolve targets
                </p>
              </div>
            </div>
          </div>
          <form action={createSlaAction} className="space-y-3.5 p-5">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Urgent default"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                id="priority"
                name="priority"
                defaultValue=""
                className="mt-1"
              >
                <option value="">Any priority</option>
                {PRIORITIES.map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ticketTypeId">Ticket type</Label>
              <Select
                id="ticketTypeId"
                name="ticketTypeId"
                defaultValue=""
                className="mt-1"
              >
                <option value="">Any type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstResponseMins">First response</Label>
                <Input
                  id="firstResponseMins"
                  name="firstResponseMins"
                  type="number"
                  min={1}
                  required
                  placeholder="Mins"
                  className="mt-1"
                />
                <p className="mt-1 text-[10px] text-slate-400">Minutes</p>
              </div>
              <div>
                <Label htmlFor="resolveMins">Resolve</Label>
                <Input
                  id="resolveMins"
                  name="resolveMins"
                  type="number"
                  min={1}
                  required
                  placeholder="Mins"
                  className="mt-1"
                />
                <p className="mt-1 text-[10px] text-slate-400">Minutes</p>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-amber-600 text-white hover:bg-amber-700"
            >
              <Plus className="h-4 w-4" />
              Create policy
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
