import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Factory,
  FileText,
  Globe,
  Hash,
  Mail,
  MapPin,
  Phone,
  ShoppingCart,
  Ticket,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CompanyEditButton } from "@/components/companies/company-edit-button";

type Props = { params: Promise<{ id: string }> };

const AVATAR = ["#ef1e1e", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ac16e0"];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function colorForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (hash + id.charCodeAt(i) * 17) % AVATAR.length;
  return AVATAR[hash];
}

function statusColor(status: string) {
  if (status === "CUSTOMER" || status === "ACTIVE") return "green" as const;
  if (status === "LEAD") return "blue" as const;
  if (status === "INACTIVE" || status === "CHURNED") return "default" as const;
  return "teal" as const;
}

function websiteHref(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default async function CompanyDetailPage({ params }: Props) {
  const session = await requireOrgSession();
  const { id } = await params;

  const company = await db.company.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      customers: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { tickets: true, orders: true } },
          orders: {
            where: { paymentStatus: { in: ["PAID", "CLEARED"] } },
            select: { total: true },
          },
        },
      },
    },
  });

  if (!company) notFound();

  const customerIds = company.customers.map((c) => c.id);

  const [openTickets, recentTickets, recentOrders, ticketCount, orderCount] =
    customerIds.length === 0
      ? ([0, [], [], 0, 0] as const)
      : await Promise.all([
          db.ticket.count({
            where: {
              organizationId: session.organizationId,
              customerId: { in: customerIds },
              stage: { isTerminal: false },
            },
          }),
          db.ticket.findMany({
            where: {
              organizationId: session.organizationId,
              customerId: { in: customerIds },
            },
            orderBy: { updatedAt: "desc" },
            take: 6,
            include: {
              stage: { select: { name: true, key: true } },
              customer: { select: { id: true, name: true } },
            },
          }),
          db.order.findMany({
            where: {
              organizationId: session.organizationId,
              customerId: { in: customerIds },
            },
            orderBy: { createdAt: "desc" },
            take: 6,
            include: {
              customer: { select: { id: true, name: true } },
            },
          }),
          db.ticket.count({
            where: {
              organizationId: session.organizationId,
              customerId: { in: customerIds },
            },
          }),
          db.order.count({
            where: {
              organizationId: session.organizationId,
              customerId: { in: customerIds },
            },
          }),
        ]);

  const revenue = company.customers.reduce(
    (sum, c) => sum + c.orders.reduce((s, o) => s + Number(o.total), 0),
    0
  );

  const location = [company.address, company.city, company.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 text-sm text-[#8b10b8] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to companies
        </Link>
        <CompanyEditButton
          company={{
            id: company.id,
            name: company.name,
            ntn: company.ntn,
            strn: company.strn,
            industry: company.industry,
            website: company.website,
            phone: company.phone,
            email: company.email,
            address: company.address,
            city: company.city,
            postalCode: company.postalCode,
            notes: company.notes,
          }}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-br from-rose-50/80 via-white to-slate-50 px-5 py-5">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-md"
              style={{ backgroundColor: colorForId(company.id) }}
            >
              {initials(company.name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {company.name}
                </h1>
                {company.industry ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    <Factory className="h-3 w-3" />
                    {company.industry}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                {company.city ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {company.city}
                  </span>
                ) : null}
                <span>Added {formatDate(company.createdAt)}</span>
                <span>Updated {formatDate(company.updatedAt)}</span>
              </p>
              {company.notes ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  {company.notes}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef1e1e]/10 text-[#ef1e1e]">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <InfoTile
            icon={<Phone className="h-3.5 w-3.5" />}
            label="Phone"
            value={
              company.phone ? (
                <a href={`tel:${company.phone}`} className="hover:text-[#8b10b8]">
                  {company.phone}
                </a>
              ) : (
                "—"
              )
            }
          />
          <InfoTile
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Email"
            value={
              company.email ? (
                <a
                  href={`mailto:${company.email}`}
                  className="break-all hover:text-[#8b10b8]"
                >
                  {company.email}
                </a>
              ) : (
                "—"
              )
            }
          />
          <InfoTile
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Website"
            value={
              company.website ? (
                <a
                  href={websiteHref(company.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#8b10b8]"
                >
                  {company.website.replace(/^https?:\/\//i, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                "—"
              )
            }
          />
          <InfoTile
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Address"
            value={location || "—"}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Contacts"
          value={company.customers.length}
          hint="Linked customers"
          icon={<Users className="h-4 w-4" />}
          tone="teal"
        />
        <Kpi
          label="Tickets"
          value={ticketCount}
          hint={`${openTickets} open`}
          icon={<Ticket className="h-4 w-4" />}
          tone="sky"
        />
        <Kpi
          label="Orders"
          value={orderCount}
          hint="Across linked contacts"
          icon={<ShoppingCart className="h-4 w-4" />}
          tone="rose"
        />
        <Kpi
          label="Paid revenue"
          value={formatCurrency(revenue)}
          hint="Paid / cleared orders"
          icon={<FileText className="h-4 w-4" />}
          tone="emerald"
          isText
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Linked contacts
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    People under this company account
                  </p>
                </div>
              </div>
              <Link
                href="/customers"
                className="text-xs font-semibold text-[#8b10b8] hover:underline"
              >
                All customers
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3 font-semibold">Name</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Contact</th>
                    <th className="px-3 py-3 font-semibold">Tickets</th>
                    <th className="px-3 py-3 font-semibold">Orders</th>
                    <th className="px-5 py-3 font-semibold">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {company.customers.map((c, i) => (
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
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{
                              backgroundColor: AVATAR[i % AVATAR.length],
                            }}
                          >
                            {initials(c.name)}
                          </div>
                          <span className="font-semibold text-slate-900 hover:text-[#8b10b8]">
                            {c.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge color={statusColor(c.status)}>{c.status}</Badge>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-slate-500">
                        <div className="space-y-0.5">
                          {c.phone ? <p>{c.phone}</p> : null}
                          {c.email ? (
                            <p className="max-w-[140px] truncate">{c.email}</p>
                          ) : null}
                          {!c.phone && !c.email ? "—" : null}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 font-medium">
                        {c._count.tickets}
                      </td>
                      <td className="px-3 py-3.5 font-medium">
                        {c._count.orders}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {company.customers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-sm text-slate-400"
                      >
                        No customers linked yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Recent tickets
                </h3>
                <Link
                  href="/tickets"
                  className="text-[11px] font-medium text-[#8b10b8]"
                >
                  View all
                </Link>
              </div>
              <div className="divide-y divide-slate-50">
                {recentTickets.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tickets/${t.id}`}
                    className="block px-5 py-3 hover:bg-slate-50/80"
                  >
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                      <span className="text-slate-400">#{t.number}</span>{" "}
                      {t.subject}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {t.customer.name} · {t.stage.name} ·{" "}
                      {formatDate(t.updatedAt)}
                    </p>
                  </Link>
                ))}
                {recentTickets.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">
                    No tickets from linked contacts
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Recent orders
                </h3>
                <Link
                  href="/sales/orders"
                  className="text-[11px] font-medium text-[#ef1e1e]"
                >
                  View all
                </Link>
              </div>
              <div className="divide-y divide-slate-50">
                {recentOrders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/sales/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/80"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        Order #{o.number}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {o.customer.name} · {o.paymentStatus} ·{" "}
                        {formatDate(o.createdAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-slate-900">
                      {formatCurrency(Number(o.total))}
                    </p>
                  </Link>
                ))}
                {recentOrders.length === 0 && (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">
                    No orders from linked contacts
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="h-fit overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:sticky xl:top-4">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-900">
              Business details
            </h3>
            <p className="text-[11px] text-slate-400">Tax IDs & registration</p>
          </div>
          <div className="space-y-4 p-5">
            <DetailRow
              icon={<Hash className="h-3.5 w-3.5" />}
              label="NTN"
              value={company.ntn || "—"}
            />
            <DetailRow
              icon={<Hash className="h-3.5 w-3.5" />}
              label="STRN"
              value={company.strn || "—"}
            />
            <DetailRow
              icon={<Factory className="h-3.5 w-3.5" />}
              label="Industry"
              value={company.industry || "—"}
            />
            <DetailRow
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="City"
              value={company.city || "—"}
            />
            <DetailRow
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Postal code"
              value={company.postalCode || "—"}
            />
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Full address
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {location || "No address on file"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
  tone,
  isText,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
  tone: "teal" | "sky" | "rose" | "emerald";
  isText?: boolean;
}) {
  const tones = {
    teal: "bg-[#ac16e0] text-white",
    sky: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-[#ef1e1e]",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  const valueTone =
    tone === "sky"
      ? "text-sky-600"
      : tone === "rose"
        ? "text-[#ef1e1e]"
        : tone === "emerald"
          ? "text-emerald-600"
          : "text-slate-900";
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p
            className={cn(
              "mt-1 font-bold",
              isText ? "text-xl" : "text-2xl",
              valueTone
            )}
          >
            {value}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
        </div>
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            tones[tone]
          )}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </span>
      <span className="text-right text-sm font-medium text-slate-900">
        {value}
      </span>
    </div>
  );
}
