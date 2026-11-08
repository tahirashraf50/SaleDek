import Link from "next/link";
import { Building2, Ticket, Users } from "lucide-react";
import { TenantStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { setOrganizationStatus } from "@/server/actions/admin";
import { CreateTenantDialog } from "@/components/admin/create-tenant-dialog";
import { Button } from "@/components/ui/button";

async function statusAction(formData: FormData) {
  "use server";
  await setOrganizationStatus(
    String(formData.get("orgId")),
    String(formData.get("status")) as TenantStatus
  );
}

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

export default async function AdminOrgsPage() {
  await requireSuperAdmin();
  const [orgs, plans] = await Promise.all([
    db.organization.findMany({
      include: {
        plan: true,
        _count: { select: { users: true, tickets: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.saaSPlan.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { key: true, name: true, priceMonthly: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Tenants
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Organizations on the platform · {orgs.length} total
          </p>
        </div>
        <CreateTenantDialog
          plans={plans.map((p) => ({
            key: p.key,
            name: p.name,
            priceMonthly: Number(p.priceMonthly),
          }))}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <span className="h-4 w-1 rounded-sm bg-teal-600" />
          <Building2 className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">
            All organizations
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Organization</th>
                <th className="px-3 py-3 font-semibold">Plan</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Workload</th>
                <th className="px-3 py-3 font-semibold">Created</th>
                <th className="px-5 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o, i) => (
                <tr
                  key={o.id}
                  className="border-b border-slate-50 transition hover:bg-slate-50/90"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: AVATAR[i % AVATAR.length] }}
                      >
                        {initials(o.name)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/orgs/${o.id}`}
                          className="font-semibold text-slate-900 hover:underline"
                        >
                          {o.name}
                        </Link>
                        <p className="text-[11px] text-slate-400">{o.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    {o.plan ? (
                      <div>
                        <p className="font-medium text-slate-800">{o.plan.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatCurrency(Number(o.plan.priceMonthly))}/mo
                        </p>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
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
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                        <Users className="h-3 w-3 text-slate-400" />
                        {o._count.users}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                        <Ticket className="h-3 w-3 text-slate-400" />
                        {o._count.tickets}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-slate-500">
                    {formatDate(o.createdAt)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/admin/orgs/${o.id}`}
                        className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open
                      </Link>
                      {o.status !== "SUSPENDED" ? (
                        <form action={statusAction}>
                          <input type="hidden" name="orgId" value={o.id} />
                          <input type="hidden" name="status" value="SUSPENDED" />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="h-8 border-rose-200 bg-white px-2.5 text-xs text-rose-700 hover:bg-rose-50"
                          >
                            Suspend
                          </Button>
                        </form>
                      ) : (
                        <form action={statusAction}>
                          <input type="hidden" name="orgId" value={o.id} />
                          <input type="hidden" name="status" value="ACTIVE" />
                          <Button
                            type="submit"
                            size="sm"
                            className="h-8 bg-teal-700 px-2.5 text-xs text-white hover:bg-teal-800"
                          >
                            Enable
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-500">
                    No tenants found.
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
