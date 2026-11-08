import Link from "next/link";
import {
  Building2,
  Plus,
  Search,
  Ticket,
  UserRound,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";
import { createDepartment } from "@/server/actions/settings";
import { DepartmentActions } from "@/components/settings/department-actions";
import { OrgModulesPanel } from "@/components/settings/org-modules-panel";
import { getOrgModules } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

async function createDepartmentAction(formData: FormData) {
  "use server";
  await createDepartment(
    String(formData.get("name")),
    String(formData.get("description") || "") || undefined
  );
}

const AVATAR = ["#ac16e0", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function SettingsDepartmentsPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;

  const baseWhere = { organizationId: session.organizationId };

  const [
    departments,
    totalAll,
    activeCount,
    inactiveCount,
    usersInDepts,
    openTickets,
    modules,
    allDeptsForSelect,
  ] = await Promise.all([
    db.department.findMany({
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
        _count: { select: { users: true, tickets: true, teams: true } },
        users: {
          where: { active: true },
          select: { id: true, name: true },
          take: 4,
          orderBy: { name: "asc" },
        },
      },
    }),
    db.department.count({ where: baseWhere }),
    db.department.count({ where: { ...baseWhere, active: true } }),
    db.department.count({ where: { ...baseWhere, active: false } }),
    db.user.count({
      where: {
        organizationId: session.organizationId,
        departmentId: { not: null },
        active: true,
      },
    }),
    db.ticket.count({
      where: {
        organizationId: session.organizationId,
        departmentId: { not: null },
        stage: { isTerminal: false },
      },
    }),
    getOrgModules(session.organizationId),
    db.department.findMany({
      where: baseWhere,
      select: { id: true, name: true, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  function href(next: { q?: string; status?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const status = next.status !== undefined ? next.status : params.status;
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    const s = qs.toString();
    return s ? `/settings/departments?${s}` : "/settings/departments";
  }

  const statusChips = [
    { id: "", label: "All", count: totalAll },
    { id: "active", label: "Active", count: activeCount },
    { id: "inactive", label: "Inactive", count: inactiveCount },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Departments
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Route tickets & team ownership · {departments.length}
            {query || statusFilter ? " matching" : " shown"}
            {totalAll !== departments.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <form action="/settings/departments" method="get" className="flex gap-2">
          {statusFilter ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="Search departments…"
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
              <p className="text-sm text-slate-500">Departments</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} active · {inactiveCount} off
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ac16e0] text-white shadow-md shadow-[0_10px_24px_-12px_rgba(172,22,224,0.35)]">
              <Building2 className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Staff assigned</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{usersInDepts}</p>
          <p className="mt-1 text-[11px] text-slate-400">Active users in a dept</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Open dept tickets</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{openTickets}</p>
          <p className="mt-1 text-[11px] text-slate-400">Currently in queue</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Empty departments</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">
            {departments.filter((d) => d._count.users === 0).length}
          </p>
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
                  ? "bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]"
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

      <OrgModulesPanel
        modules={modules.map((m) => ({
          key: m.key,
          enabled: m.enabled,
          departmentId: m.departmentId,
        }))}
        departments={allDeptsForSelect}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
              <h2 className="text-base font-semibold text-slate-900">
                All departments
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Used for forwards & dept queue
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Members</th>
                  <th className="px-3 py-3 font-semibold">Workload</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, i) => (
                  <tr
                    key={d.id}
                    className={cn(
                      "border-b border-slate-50 transition hover:bg-slate-50/90",
                      !d.active && "opacity-70"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                          style={{
                            backgroundColor: AVATAR[i % AVATAR.length],
                          }}
                        >
                          {initials(d.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {d.name}
                          </p>
                          <p className="line-clamp-1 text-[11px] text-slate-400">
                            {d.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {d.users.length > 0 ? (
                        <div className="flex items-center">
                          <div className="flex -space-x-2">
                            {d.users.map((u, ui) => (
                              <div
                                key={u.id}
                                title={u.name}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white"
                                style={{
                                  backgroundColor:
                                    AVATAR[(i + ui + 1) % AVATAR.length],
                                }}
                              >
                                {initials(u.name)}
                              </div>
                            ))}
                          </div>
                          {d._count.users > d.users.length ? (
                            <span className="ml-2 text-[11px] font-medium text-slate-500">
                              +{d._count.users - d.users.length}
                            </span>
                          ) : (
                            <span className="ml-2 text-[11px] text-slate-400">
                              {d._count.users}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <UserRound className="h-3.5 w-3.5" />
                          No members
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                          <Users className="h-3 w-3 text-slate-400" />
                          {d._count.users} users
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                          <Ticket className="h-3 w-3 text-slate-400" />
                          {d._count.tickets} tickets
                        </span>
                        {d._count.teams > 0 ? (
                          <span className="rounded-md bg-[rgba(172,22,224,0.08)] px-1.5 py-0.5 text-[10px] font-medium text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.15)]">
                            {d._count.teams} teams
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {d.active ? (
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
                    <td className="px-3 py-3.5 text-xs text-slate-500">
                      {formatDate(d.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <DepartmentActions
                        department={{
                          id: d.id,
                          name: d.name,
                          description: d.description,
                          active: d.active,
                          userCount: d._count.users,
                          ticketCount: d._count.tickets,
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-800">
                          No departments found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Clear filters or create a department on the right.
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
          <div className="border-b border-slate-100 bg-gradient-to-br from-[#f6f3fb]/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  New department
                </h2>
                <p className="text-[11px] text-slate-500">
                  For ticket routing & ownership
                </p>
              </div>
            </div>
          </div>
          <form action={createDepartmentAction} className="space-y-3.5 p-5">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Billing, Claims, Sales"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                placeholder="What this department handles…"
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#ac16e0] text-white hover:bg-[#8b10b8]"
            >
              <Plus className="h-4 w-4" />
              Create department
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
