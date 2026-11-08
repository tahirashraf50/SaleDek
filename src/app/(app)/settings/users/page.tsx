import Link from "next/link";
import { Role } from "@prisma/client";
import {
  Building2,
  Mail,
  Search,
  Shield,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";
import { createUser } from "@/server/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { UserLoginToggle } from "@/components/settings/user-login-toggle";

type Props = {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
};

async function createUserAction(formData: FormData) {
  "use server";
  await createUser({
    name: String(formData.get("name")),
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    role: String(formData.get("role")) as Role,
    departmentId: String(formData.get("departmentId") || "") || undefined,
  });
}

const ROLES: Role[] = [
  "ORG_ADMIN",
  "MANAGER",
  "AGENT",
  "DEPARTMENT_USER",
  "VIEWER",
];

const AVATAR = ["#ac16e0", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"];

function roleLabel(role: string) {
  return role
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

function roleBadge(role: Role) {
  if (role === "ORG_ADMIN" || role === "SUPER_ADMIN") return "red" as const;
  if (role === "MANAGER") return "violet" as const;
  if (role === "AGENT") return "teal" as const;
  if (role === "DEPARTMENT_USER") return "blue" as const;
  return "default" as const;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function SettingsUsersPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const roleFilter =
    params.role && ROLES.includes(params.role as Role)
      ? (params.role as Role)
      : undefined;
  const statusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;

  const baseWhere = { organizationId: session.organizationId! };

  const [users, departments, totalAll, activeCount, inactiveCount, byRole] =
    await Promise.all([
      db.user.findMany({
        where: {
          ...baseWhere,
          ...(roleFilter ? { role: roleFilter } : {}),
          ...(statusFilter === "active" ? { active: true } : {}),
          ...(statusFilter === "inactive" ? { active: false } : {}),
          ...(query
            ? {
                OR: [
                  { name: { contains: query, mode: "insensitive" as const } },
                  { email: { contains: query, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ active: "desc" }, { name: "asc" }],
        include: {
          department: { select: { id: true, name: true } },
          _count: {
            select: {
              assignedTickets: true,
              createdOrders: true,
              assignedConversations: true,
            },
          },
        },
      }),
      db.department.findMany({
        where: { organizationId: session.organizationId!, active: true },
        orderBy: { name: "asc" },
      }),
      db.user.count({ where: baseWhere }),
      db.user.count({ where: { ...baseWhere, active: true } }),
      db.user.count({ where: { ...baseWhere, active: false } }),
      db.user.groupBy({
        by: ["role"],
        where: baseWhere,
        _count: true,
      }),
    ]);

  const roleCount = Object.fromEntries(
    byRole.map((r) => [r.role, r._count])
  ) as Record<string, number>;

  function href(next: { q?: string; role?: string; status?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const role = next.role !== undefined ? next.role : params.role;
    const status = next.status !== undefined ? next.status : params.status;
    if (q) qs.set("q", q);
    if (role) qs.set("role", role);
    if (status) qs.set("status", status);
    const s = qs.toString();
    return s ? `/settings/users?${s}` : "/settings/users";
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
            Users
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Team access, roles & departments · {users.length}
            {query || roleFilter || statusFilter ? " matching" : " shown"}
            {totalAll !== users.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <form action="/settings/users" method="get" className="flex gap-2">
          {roleFilter ? (
            <input type="hidden" name="role" value={roleFilter} />
          ) : null}
          {statusFilter ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="Search name or email…"
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
              <p className="text-sm text-slate-500">Team members</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} active · {inactiveCount} off
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ac16e0] text-white shadow-md shadow-[0_10px_24px_-12px_rgba(172,22,224,0.35)]">
              <Users className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Agents</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">
            {roleCount.AGENT || 0}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Frontline sales & inbox</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Managers / admins</p>
          <p className="mt-1 text-2xl font-bold text-violet-600">
            {(roleCount.MANAGER || 0) + (roleCount.ORG_ADMIN || 0)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Ops & workspace control</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{inactiveCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Cannot sign in</p>
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
        <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:inline-block" />
        {ROLES.map((role) => {
          const active = roleFilter === role;
          return (
            <Link
              key={role}
              href={href({ role: active ? "" : role })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {roleLabel(role)}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {roleCount[role] || 0}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
              <h2 className="text-base font-semibold text-slate-900">
                Team members
              </h2>
            </div>
            <p className="text-xs text-slate-400">Roles control CRM access</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-3 py-3 font-semibold">Role</th>
                  <th className="px-3 py-3 font-semibold">Department</th>
                  <th className="px-3 py-3 font-semibold">Workload</th>
                  <th className="px-3 py-3 font-semibold">Login</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-slate-50 transition hover:bg-slate-50/90",
                      !u.active && "opacity-70"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/settings/users/${u.id}`}
                        className="flex items-center gap-3"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                          style={{
                            backgroundColor: AVATAR[i % AVATAR.length],
                          }}
                        >
                          {initials(u.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 hover:text-[#8b10b8]">
                            {u.name}
                            {u.id === session.user.id ? (
                              <span className="ml-1.5 text-[10px] font-medium text-[#8b10b8]">
                                you
                              </span>
                            ) : null}
                          </p>
                          <p className="flex items-center gap-1 truncate text-[11px] text-slate-400">
                            <Mail className="h-3 w-3 shrink-0" />
                            {u.email}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge color={roleBadge(u.role)}>{roleLabel(u.role)}</Badge>
                    </td>
                    <td className="px-3 py-3.5">
                      {u.department?.name ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {u.department.name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                          {u._count.assignedTickets} tickets
                        </span>
                        <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                          {u._count.createdOrders} orders
                        </span>
                        {u._count.assignedConversations > 0 ? (
                          <span className="rounded-md bg-[rgba(172,22,224,0.08)] px-1.5 py-0.5 text-[10px] font-medium text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.15)]">
                            {u._count.assignedConversations} inbox
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <UserLoginToggle
                          userId={u.id}
                          active={u.active}
                          disabled={u.id === session.user.id}
                        />
                        <span
                          className={cn(
                            "text-[11px] font-medium",
                            u.active ? "text-emerald-700" : "text-slate-500"
                          )}
                        >
                          {u.active ? "On" : "Off"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          href={`/settings/users/${u.id}`}
                          className="text-xs font-semibold text-[#8b10b8] hover:underline"
                        >
                          Manage profile
                        </Link>
                        <span className="text-[10px] text-slate-400">
                          Joined {formatDate(u.createdAt)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-800">
                          No users found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Try another search or add a teammate on the right.
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
                <UserPlus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Add user
                </h2>
                <p className="text-[11px] text-slate-500">
                  Invite with role & department
                </p>
              </div>
            </div>
          </div>
          <form action={createUserAction} className="space-y-3.5 p-5">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Ali Raza"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="ali@company.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Temporary password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={6}
                required
                placeholder="Min 6 characters"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="role" className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-400" />
                Role
              </Label>
              <Select
                id="role"
                name="role"
                defaultValue="AGENT"
                className="mt-1"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select
                id="departmentId"
                name="departmentId"
                defaultValue=""
                className="mt-1"
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#ac16e0] text-white hover:bg-[#8b10b8]"
            >
              <UserPlus className="h-4 w-4" />
              Create user
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
