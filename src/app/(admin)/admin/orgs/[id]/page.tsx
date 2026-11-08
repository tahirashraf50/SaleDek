import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarRange,
  CreditCard,
  ExternalLink,
  Users,
  Wallet,
} from "lucide-react";
import { addYears, differenceInCalendarDays, format } from "date-fns";
import { TenantStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/session";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { orgLogoPublicUrl } from "@/lib/org-logo";
import {
  setOrganizationPlan,
  setOrganizationStatus,
} from "@/server/actions/admin";
import { OrgLogoForm } from "@/components/admin/org-logo-form";
import { OrgBillingPanel } from "@/components/admin/org-billing-panel";
import { DeleteTenantButton } from "@/components/admin/delete-tenant-button";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type Props = { params: Promise<{ id: string }> };

async function planAction(formData: FormData) {
  "use server";
  await setOrganizationPlan(
    String(formData.get("orgId")),
    String(formData.get("planId"))
  );
}

async function statusAction(formData: FormData) {
  "use server";
  await setOrganizationStatus(
    String(formData.get("orgId")),
    String(formData.get("status")) as TenantStatus
  );
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-900",
  TRIAL: "border-amber-200 bg-amber-50 text-amber-900",
  SUSPENDED: "border-rose-200 bg-rose-50 text-rose-900",
};

export default async function AdminOrgDetailPage({ params }: Props) {
  await requireSuperAdmin();
  const { id } = await params;

  const [org, plans] = await Promise.all([
    db.organization.findUnique({
      where: { id },
      include: {
        plan: true,
        users: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
          },
        },
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        platformInvoices: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            events: { orderBy: { createdAt: "desc" }, take: 8 },
          },
        },
        _count: {
          select: { users: true, tickets: true, customers: true, orders: true },
        },
      },
    }),
    db.saaSPlan.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  if (!org) notFound();

  const currentSub = org.subscriptions[0] || null;
  const startedAt =
    currentSub?.startedAt ||
    (org.status === "TRIAL" ? org.createdAt : org.createdAt);
  const endsAt =
    currentSub?.endsAt ||
    currentSub?.renewsAt ||
    org.trialEndsAt ||
    addYears(startedAt, 1);

  const revenuePaid = org.platformInvoices
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + Number(i.amount), 0);
  const revenueOpen = org.platformInvoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((s, i) => s + Number(i.amount), 0);
  const mrr = org.plan ? Number(org.plan.priceMonthly) : 0;
  const daysLeft = differenceInCalendarDays(endsAt, new Date());
  // Next renewal year = period end year (or current+1 if already past)
  const renewalYear =
    endsAt > new Date() ? endsAt.getFullYear() : new Date().getFullYear() + 1;

  const orgAdmin = org.users.find((u) => u.role === "ORG_ADMIN" && u.active);
  const logoUrl = org.logoPath
    ? `${orgLogoPublicUrl(org.slug)}?v=${encodeURIComponent(org.updatedAt.toISOString())}`
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/orgs"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3 w-3" />
            Tenants
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-sm"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white shadow-sm">
                {org.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[28px] font-bold tracking-tight text-slate-900">
                  {org.name}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                    STATUS_STYLE[org.status]
                  )}
                >
                  <BadgeCheck className="h-3 w-3" />
                  {org.status}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {org.slug}
                {org.plan ? ` · ${org.plan.name}` : ""} · created{" "}
                {formatDate(org.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/portal/${org.slug}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Portal
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link
            href={`/shop/${org.slug}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Shop
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <DeleteTenantButton
            orgId={org.id}
            orgName={org.name}
            orgSlug={org.slug}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Revenue earned</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">
                {formatCurrency(revenuePaid)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Paid invoices
                {revenueOpen > 0
                  ? ` · ${formatCurrency(revenueOpen)} open`
                  : ""}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Plan MRR</p>
              <p className="mt-1 text-2xl font-bold text-teal-800">
                {formatCurrency(mrr)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {formatCurrency(mrr * 12)} / year
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <CreditCard className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Period</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {format(startedAt, "dd MMM yy")} → {format(endsAt, "dd MMM yy")}
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] font-medium",
                  daysLeft < 0
                    ? "text-rose-600"
                    : daysLeft <= 30
                      ? "text-amber-600"
                      : "text-slate-400"
                )}
              >
                {daysLeft < 0
                  ? `Expired ${Math.abs(daysLeft)}d ago`
                  : `${daysLeft} days left`}
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <CalendarRange className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="app-kpi rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Workspace</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {org._count.users}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {org._count.customers} customers · {org._count.tickets} tickets
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <Users className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <OrgBillingPanel
          orgId={org.id}
          startedAt={startedAt.toISOString()}
          endsAt={endsAt.toISOString()}
          defaultBillingEmail={orgAdmin?.email || null}
          nextYear={renewalYear}
          invoices={org.platformInvoices.map((inv) => ({
            id: inv.id,
            number: inv.number,
            year: inv.year,
            amount: Number(inv.amount),
            status: inv.status,
            periodStart: inv.periodStart.toISOString(),
            periodEnd: inv.periodEnd.toISOString(),
            dueAt: inv.dueAt?.toISOString() || null,
            sentAt: inv.sentAt?.toISOString() || null,
            paidAt: inv.paidAt?.toISOString() || null,
            billingEmail: inv.billingEmail,
            notes: inv.notes,
            events: inv.events.map((e) => ({
              id: e.id,
              type: e.type,
              toEmail: e.toEmail,
              subject: e.subject,
              mode: e.mode,
              createdAt: e.createdAt.toISOString(),
            })),
          }))}
        />

        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 bg-gradient-to-br from-teal-50/80 to-transparent px-5 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-700" />
                <h2 className="text-base font-semibold text-slate-900">
                  Branding
                </h2>
              </div>
            </div>
            <div className="p-5">
              <OrgLogoForm
                orgId={org.id}
                orgSlug={org.slug}
                hasLogo={Boolean(org.logoPath)}
                logoVersion={org.updatedAt.toISOString()}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Plan & status
              </h2>
            </div>
            <div className="space-y-4 p-5">
              <form action={planAction} className="space-y-2">
                <input type="hidden" name="orgId" value={org.id} />
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Assign plan
                </label>
                <div className="flex gap-2">
                  <Select
                    name="planId"
                    defaultValue={org.planId || ""}
                    required
                    className="flex-1"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(Number(p.priceMonthly))}/mo
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-9 bg-teal-700 text-white hover:bg-teal-800"
                  >
                    Assign
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Demo / trial plans use their trial days · paid plans start a
                  1-year ACTIVE period
                </p>
              </form>
              <form action={statusAction} className="space-y-2">
                <input type="hidden" name="orgId" value={org.id} />
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Tenant status
                </label>
                <div className="flex gap-2">
                  <Select
                    name="status"
                    defaultValue={org.status}
                    className="flex-1"
                  >
                    <option value="TRIAL">TRIAL</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </Select>
                  <Button type="submit" size="sm" variant="outline" className="h-9">
                    Update
                  </Button>
                </div>
              </form>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">Users</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {org.users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {u.name}
                      {!u.active ? (
                        <span className="ml-1 text-[10px] text-rose-600">
                          off
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {u.email}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-100">
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Subscription history
              </h2>
            </div>
            <div className="divide-y divide-slate-50">
              {org.subscriptions.map((s) => (
                <div
                  key={s.id}
                  className="flex justify-between gap-2 px-5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {s.plan.name} · {s.status}
                    </p>
                    <p className="text-slate-400">
                      {formatDate(s.startedAt)}
                      {s.endsAt ? ` → ${formatDate(s.endsAt)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {org.subscriptions.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  No subscriptions yet
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
