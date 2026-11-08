import Link from "next/link";
import { Building2, Mail, Phone, Search, Users } from "lucide-react";
import { CustomerStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomersAddButton } from "@/components/customers/customers-add-button";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "LEAD", label: "Leads" },
  { id: "ACTIVE", label: "Active" },
  { id: "INACTIVE", label: "Inactive" },
  { id: "BLOCKED", label: "Blocked" },
];

const AVATAR = ["#ef1e1e", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ac16e0"];

function statusBadge(status: CustomerStatus) {
  if (status === "ACTIVE") return "green" as const;
  if (status === "BLOCKED") return "red" as const;
  if (status === "LEAD") return "blue" as const;
  if (status === "INACTIVE") return "amber" as const;
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

export default async function CustomersPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const { q, status } = await searchParams;
  const query = q?.trim();
  const statusFilter =
    status && ["LEAD", "ACTIVE", "INACTIVE", "BLOCKED"].includes(status)
      ? (status as CustomerStatus)
      : undefined;

  const where = {
    organizationId: session.organizationId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
            { cnic: { contains: query } },
            { city: { contains: query } },
          ],
        }
      : {}),
  };

  const [customers, totalAll, byStatus, recentLeads] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        company: { select: { name: true } },
        owner: { select: { name: true } },
        _count: { select: { tickets: true, orders: true, conversations: true } },
      },
    }),
    db.customer.count({ where: { organizationId: session.organizationId } }),
    db.customer.groupBy({
      by: ["status"],
      where: { organizationId: session.organizationId },
      _count: true,
    }),
    db.customer.count({
      where: {
        organizationId: session.organizationId,
        status: "LEAD",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  const statusCount = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count])
  ) as Record<string, number>;
  const activeCount = statusCount.ACTIVE || 0;
  const leadCount = statusCount.LEAD || 0;

  function filterHref(nextStatus: string) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (nextStatus) params.set("status", nextStatus);
    const s = params.toString();
    return s ? `/customers?${s}` : "/customers";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Customers
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Contacts, leads & accounts · {customers.length}
            {query || statusFilter ? " matching" : " shown"}
            {totalAll !== customers.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/customers" method="get" className="flex gap-2">
            {statusFilter ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                name="q"
                placeholder="Search name, phone, email, CNIC…"
                defaultValue={query || ""}
                className="h-10 w-64 border-slate-200 bg-white pl-9 shadow-sm sm:w-72"
              />
            </div>
            <Button type="submit" variant="outline" className="h-10 bg-white">
              Search
            </Button>
          </form>
          <CustomersAddButton />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Total contacts</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1e1e] text-white shadow-md shadow-red-500/20">
              <Users className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Paying / engaged</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Leads</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{leadCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            +{recentLeads} this week
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Blocked / inactive</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {(statusCount.BLOCKED || 0) + (statusCount.INACTIVE || 0)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Needs review</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = (statusFilter || "") === f.id;
          const count =
            f.id === ""
              ? totalAll
              : statusCount[f.id] || 0;
          return (
            <Link
              key={f.id || "all"}
              href={filterHref(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-[#ef1e1e] text-white shadow-sm shadow-red-500/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
            <h2 className="text-base font-semibold text-slate-900">
              All customers
            </h2>
          </div>
          <p className="text-xs text-slate-400">Click a row to open profile</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Contact</th>
                <th className="px-3 py-3 font-semibold">Company</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Activity</th>
                <th className="px-5 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-50 transition hover:bg-slate-50/90"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/customers/${c.id}`}
                      className="flex items-center gap-3"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: AVATAR[i % AVATAR.length] }}
                      >
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 hover:text-[#ef1e1e]">
                          {c.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {c.city || c.source || "No city"}
                          {c.owner?.name ? ` · ${c.owner.name}` : ""}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="space-y-0.5 text-slate-600">
                      {c.phone ? (
                        <p className="flex items-center gap-1.5 text-xs">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {c.phone}
                        </p>
                      ) : null}
                      {c.email ? (
                        <p className="flex max-w-[180px] items-center gap-1.5 truncate text-xs">
                          <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                          {c.email}
                        </p>
                      ) : null}
                      {!c.phone && !c.email ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    {c.company?.name ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        {c.company.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <Badge color={statusBadge(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                        {c._count.orders} orders
                      </span>
                      <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                        {c._count.tickets} tickets
                      </span>
                      {c._count.conversations > 0 ? (
                        <span className="rounded-md bg-[rgba(172,22,224,0.08)] px-1.5 py-0.5 text-[10px] font-medium text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.15)]">
                          {c._count.conversations} inbox
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">
                    {formatDate(c.updatedAt)}
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <Users className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-slate-800">No customers found</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try another search, clear filters, or add a new contact.
                      </p>
                      <div className="mt-4">
                        <CustomersAddButton />
                      </div>
                    </div>
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
