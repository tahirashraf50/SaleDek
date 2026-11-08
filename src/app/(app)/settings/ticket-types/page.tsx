import Link from "next/link";
import {
  Layers,
  Plus,
  Search,
  ShieldAlert,
  Ticket,
  Tags,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  createTicketType,
  setTicketTypeActive,
} from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

async function createTicketTypeAction(formData: FormData) {
  "use server";
  await createTicketType(
    String(formData.get("name")),
    String(formData.get("description") || "") || undefined
  );
}

async function toggleTicketTypeAction(formData: FormData) {
  "use server";
  await setTicketTypeActive(
    String(formData.get("id")),
    formData.get("active") === "true"
  );
}

const ACCENT = ["#ef1e1e", "#ac16e0", "#3b82f6", "#f59e0b", "#8b5cf6", "#22c55e"];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function SettingsTicketTypesPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;

  const baseWhere = { organizationId: session.organizationId };

  const [types, totalAll, activeCount, inactiveCount, ticketsWithType, openWithType] =
    await Promise.all([
      db.ticketType.findMany({
        where: {
          ...baseWhere,
          ...(statusFilter === "active" ? { active: true } : {}),
          ...(statusFilter === "inactive" ? { active: false } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  {
                    description: {
                      contains: query,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: {
          _count: { select: { tickets: true, slaPolicies: true } },
        },
      }),
      db.ticketType.count({ where: baseWhere }),
      db.ticketType.count({ where: { ...baseWhere, active: true } }),
      db.ticketType.count({ where: { ...baseWhere, active: false } }),
      db.ticket.count({
        where: {
          organizationId: session.organizationId,
          typeId: { not: null },
        },
      }),
      db.ticket.count({
        where: {
          organizationId: session.organizationId,
          typeId: { not: null },
          stage: { isTerminal: false },
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
    return s ? `/settings/ticket-types?${s}` : "/settings/ticket-types";
  }

  const statusChips = [
    { id: "", label: "All", count: totalAll },
    { id: "active", label: "Active", count: activeCount },
    { id: "inactive", label: "Inactive", count: inactiveCount },
  ];

  const unusedInList = types.filter((t) => t._count.tickets === 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Ticket types
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Classify complaints & service work · {types.length}
            {query || statusFilter ? " matching" : " shown"}
            {totalAll !== types.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <form action="/settings/ticket-types" method="get" className="flex gap-2">
          {statusFilter ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="Search types…"
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
              <p className="text-sm text-slate-500">Ticket types</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} active · {inactiveCount} off
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1e1e] text-white shadow-md shadow-red-500/25">
              <Tags className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Typed tickets</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{ticketsWithType}</p>
          <p className="mt-1 text-[11px] text-slate-400">All-time with a type</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Open typed tickets</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{openWithType}</p>
          <p className="mt-1 text-[11px] text-slate-400">Currently in queue</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Unused types</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{unusedInList}</p>
          <p className="mt-1 text-[11px] text-slate-400">In current list</p>
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
                  ? "bg-[#ef1e1e] text-white shadow-sm shadow-red-500/25"
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
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">
                All types
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Used in inbox, complaints & SLA
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-3 py-3 font-semibold">Usage</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t, i) => (
                  <tr
                    key={t.id}
                    className={cn(
                      "border-b border-slate-50 transition hover:bg-slate-50/90",
                      !t.active && "opacity-70"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                          style={{
                            backgroundColor: ACCENT[i % ACCENT.length],
                          }}
                        >
                          {initials(t.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {t.name}
                          </p>
                          <p className="line-clamp-1 text-[11px] text-slate-400">
                            {t.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                          <Ticket className="h-3 w-3 text-slate-400" />
                          {t._count.tickets} tickets
                        </span>
                        {t._count.slaPolicies > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100">
                            <ShieldAlert className="h-3 w-3" />
                            {t._count.slaPolicies} SLA
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {t.active ? (
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
                      <form action={toggleTicketTypeAction} className="inline">
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={t.active ? "false" : "true"}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="h-8 bg-white text-xs"
                        >
                          {t.active ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
                {types.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Layers className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-800">
                          No ticket types found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Clear filters or create a type on the right.
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
          <div className="border-b border-slate-100 bg-gradient-to-br from-red-50/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ef1e1e] text-white shadow-sm shadow-red-500/25">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  New ticket type
                </h2>
                <p className="text-[11px] text-slate-500">
                  For complaints & service tickets
                </p>
              </div>
            </div>
          </div>
          <form action={createTicketTypeAction} className="space-y-3.5 p-5">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Billing, Warranty, Complaint"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                placeholder="When agents should pick this type…"
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#ef1e1e] text-white hover:bg-[#d41919]"
            >
              <Plus className="h-4 w-4" />
              Create type
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
