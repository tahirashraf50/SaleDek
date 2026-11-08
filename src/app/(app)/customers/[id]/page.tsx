import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CreditCard,
  FileText,
  Hash,
  IdCard,
  Inbox,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShoppingBag,
  Ticket,
  TrendingUp,
  User,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { addCustomerNote } from "@/server/actions/customers";
import { CustomerEditButton } from "@/components/customers/customer-edit-button";
import { CustomerDocuments } from "@/components/customers/customer-documents";
import { CustomerVehicles } from "@/components/customers/customer-vehicles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  extractVehiclePolicies,
  parseOrderFormValues,
} from "@/lib/product-form";

type Props = { params: Promise<{ id: string }> };

async function addNoteAction(formData: FormData) {
  "use server";
  const customerId = String(formData.get("customerId"));
  const body = String(formData.get("body") || "").trim();
  if (!body) return;
  await addCustomerNote(customerId, body);
}

function Section({
  id,
  title,
  icon: Icon,
  accent = "teal",
  action,
  children,
  flush,
}: {
  id: string;
  title: string;
  icon: (props: { className?: string }) => ReactNode;
  accent?: "teal" | "amber" | "rose" | "sky" | "violet";
  action?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  const bar: Record<string, string> = {
    teal: "bg-[#ac16e0]",
    amber: "bg-amber-600",
    rose: "bg-[#ef1e1e]",
    sky: "bg-sky-500",
    violet: "bg-violet-600",
  };
  return (
    <section
      id={id}
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-4 w-1 rounded-sm", bar[accent])} />
          <Icon className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const session = await requireOrgSession();
  const { id } = await params;

  const [customer, companies] = await Promise.all([
    db.customer.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        company: true,
        owner: { select: { name: true } },
        notes: { orderBy: { createdAt: "desc" }, take: 20 },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { user: { select: { name: true } } },
        },
        tickets: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { stage: true },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            items: true,
            payments: { orderBy: { createdAt: "desc" }, take: 5 },
            attachments: {
              where: { label: { startsWith: "Policy —" } },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, label: true },
            },
          },
        },
        conversations: {
          orderBy: { lastMessageAt: "desc" },
          take: 15,
          include: {
            messages: { orderBy: { sentAt: "desc" }, take: 1 },
          },
        },
        deals: {
          orderBy: { updatedAt: "desc" },
          take: 15,
          include: { stage: true },
        },
        attachments: {
          where: { ticketId: null },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    }),
    db.company.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  if (!customer) notFound();

  const custom =
    customer.customData && typeof customer.customData === "object"
      ? (customer.customData as Record<string, unknown>)
      : {};
  const jobTitle = typeof custom.jobTitle === "string" ? custom.jobTitle : null;

  const totalSpent = customer.orders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((s, o) => s + Number(o.total), 0);

  const purchasedProducts = customer.orders.flatMap((o) =>
    o.items.map((item) => ({
      orderId: o.id,
      orderNumber: o.number,
      paymentStatus: o.paymentStatus,
      date: o.createdAt,
      name: item.name.split(" · ")[0] || item.name,
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
      unitPrice: Number(item.unitPrice),
    }))
  );

  const vehiclePolicies = extractVehiclePolicies(
    customer.orders.map((o) => ({
      id: o.id,
      number: o.number,
      paymentStatus: o.paymentStatus,
      total: Number(o.total),
      createdAt: o.createdAt,
      policyNumber: o.policyNumber,
      underwritingStatus: o.underwritingStatus,
      policyDocumentId: o.attachments[0]?.id || null,
      policyDocumentLabel: o.attachments[0]?.label || null,
      items: o.items.map((i) => ({
        name: i.name,
        formValues: parseOrderFormValues(i.formValues),
      })),
    }))
  );

  const issuedPolicies = customer.orders.filter((o) => o.policyNumber);
  const openTickets = customer.tickets.filter(
    (t) => !["RESOLVED", "CLOSED"].includes(t.stage.key)
  ).length;

  const initials = customer.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const nav = [
    { href: "#policies", label: "Policies", count: issuedPolicies.length },
    { href: "#vehicles", label: "Vehicles", count: vehiclePolicies.length },
    { href: "#products", label: "Products", count: purchasedProducts.length },
    { href: "#orders", label: "Orders", count: customer.orders.length },
    { href: "#tickets", label: "Tickets", count: customer.tickets.length },
    { href: "#conversations", label: "Inbox", count: customer.conversations.length },
    { href: "#deals", label: "Deals", count: customer.deals.length },
    { href: "#documents", label: "Docs", count: customer.attachments.length },
    { href: "#notes", label: "Notes", count: customer.notes.length },
    { href: "#activity", label: "Activity", count: customer.activities.length },
  ];

  const kpis = [
    {
      label: "Lifetime value",
      value: formatCurrency(totalSpent),
      hint: "Paid orders",
      icon: TrendingUp,
      tone: "bg-[#ac16e0] shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]",
      valueClass: "text-[#8b10b8]",
    },
    {
      label: "Orders",
      value: String(customer.orders.length),
      hint: `${issuedPolicies.length} with policy #`,
      icon: ShoppingBag,
      tone: "bg-sky-500 shadow-sky-500/25",
      valueClass: "text-slate-900",
    },
    {
      label: "Open tickets",
      value: String(openTickets),
      hint: `${customer.tickets.length} total`,
      icon: Ticket,
      tone: "bg-amber-600 shadow-amber-600/25",
      valueClass: "text-amber-700",
    },
    {
      label: "Conversations",
      value: String(customer.conversations.length),
      hint: "Inbox threads",
      icon: MessageSquare,
      tone: "bg-violet-600 shadow-violet-600/25",
      valueClass: "text-slate-900",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Profile header */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="h-1.5 bg-gradient-to-r from-[#ac16e0] via-[#f6f3fb]0 to-amber-500" />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
          <div className="min-w-0">
            <Link
              href="/customers"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Customers
            </Link>
            <div className="mt-3 flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f6f3fb]0 to-[#8b10b8] text-xl font-bold text-white shadow-lg shadow-[0_10px_24px_-12px_rgba(172,22,224,0.35)]">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
                    {customer.name}
                  </h1>
                  <Badge
                    color={customer.status === "ACTIVE" ? "green" : "default"}
                    className="rounded-lg"
                  >
                    {customer.status}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {customer.phone ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                      <Phone className="h-3 w-3 text-slate-400" />
                      {customer.phone}
                    </span>
                  ) : null}
                  {customer.email ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                      <Mail className="h-3 w-3 text-slate-400" />
                      {customer.email}
                    </span>
                  ) : null}
                  {customer.city ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {customer.city}
                    </span>
                  ) : null}
                  {customer.cnic ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                      <IdCard className="h-3 w-3 text-slate-400" />
                      {customer.cnic}
                    </span>
                  ) : null}
                </div>
                {(jobTitle || customer.company || customer.owner?.name) && (
                  <p className="mt-2 text-xs text-slate-500">
                    {jobTitle || null}
                    {jobTitle && customer.company ? " at " : null}
                    {customer.company?.name}
                    {customer.owner?.name
                      ? ` · Owner ${customer.owner.name}`
                      : null}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CustomerEditButton
              customer={{
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                cnic: customer.cnic,
                address: customer.address,
                city: customer.city,
                source: customer.source,
                status: customer.status,
                companyId: customer.companyId,
                jobTitle,
                companies,
              }}
            />
            <Link href="/inbox">
              <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-white">
                <Inbox className="h-3.5 w-3.5" />
                Inbox
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
          >
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
                  "flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md",
                  k.tone
                )}
              >
                <k.icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Section nav */}
      <div className="sticky top-0 z-10 -mx-1 overflow-x-auto rounded-xl border border-slate-100 bg-white/95 px-2 py-2 shadow-sm backdrop-blur">
        <div className="flex min-w-max gap-1">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-[rgba(172,22,224,0.08)] hover:text-[#8b10b8]"
            >
              {item.label}
              <span className="rounded-md bg-slate-100 px-1.5 text-[10px] text-slate-500">
                {item.count}
              </span>
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Section
            id="policies"
            title="Policies"
            icon={Hash}
            accent="amber"
            action={
              <span className="text-[11px] font-medium text-slate-400">
                {issuedPolicies.length} issued
              </span>
            }
          >
            {issuedPolicies.length === 0 ? (
              <Empty>
                No policy numbers yet — Underwriting allocations appear here.
              </Empty>
            ) : (
              <div className="space-y-2">
                {issuedPolicies.map((o) => {
                  const doc = o.attachments[0];
                  return (
                    <div
                      key={o.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/90 to-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700/80">
                          Policy #
                        </p>
                        <p className="font-mono text-lg font-bold text-amber-950">
                          {o.policyNumber}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-600">
                          Order #{o.number}
                          {o.items[0]?.name
                            ? ` · ${o.items[0].name.split(" · ")[0]}`
                            : ""}
                          {" · "}
                          {formatDate(o.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          color={
                            o.underwritingStatus === "SENT" ? "green" : "teal"
                          }
                        >
                          {o.underwritingStatus.replace(/_/g, " ")}
                        </Badge>
                        {doc ? (
                          <a
                            href={`/api/attachments/${doc.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-[rgba(172,22,224,0.25)] bg-[rgba(172,22,224,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[#8b10b8] hover:bg-[rgba(172,22,224,0.12)]"
                          >
                            <FileText className="h-3 w-3" />
                            Document
                          </a>
                        ) : null}
                        <Link
                          href={`/underwriting/${o.id}`}
                          className="text-xs font-medium text-slate-500 hover:underline"
                        >
                          Case →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <section id="vehicles" className="scroll-mt-20">
            <CustomerVehicles policies={vehiclePolicies} />
          </section>

          <Section
            id="products"
            title="Products purchased"
            icon={ShoppingBag}
            accent="teal"
            flush
          >
            {purchasedProducts.length === 0 ? (
              <div className="p-5">
                <Empty>No products purchased yet.</Empty>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-2.5 font-semibold">Product</th>
                      <th className="px-4 py-2.5 font-semibold">Qty</th>
                      <th className="px-4 py-2.5 font-semibold">Total</th>
                      <th className="px-4 py-2.5 font-semibold">Order</th>
                      <th className="px-4 py-2.5 font-semibold">Payment</th>
                      <th className="px-5 py-2.5 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchasedProducts.map((p, idx) => (
                      <tr
                        key={`${p.orderId}-${idx}`}
                        className="border-b border-slate-50 transition hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.quantity}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {formatCurrency(p.lineTotal)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/sales/orders/${p.orderId}`}
                            className="font-medium text-[#8b10b8] hover:underline"
                          >
                            #{p.orderNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            color={p.paymentStatus === "PAID" ? "green" : "amber"}
                          >
                            {p.paymentStatus}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {formatDate(p.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section
            id="orders"
            title="Order history"
            icon={CreditCard}
            accent="rose"
            action={
              <span className="text-[11px] font-medium text-slate-400">
                {customer.orders.length} orders
              </span>
            }
          >
            {customer.orders.length === 0 ? (
              <Empty>No orders yet</Empty>
            ) : (
              <div className="space-y-3">
                {customer.orders.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-slate-200 hover:bg-white"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Link
                          href={`/sales/orders/${o.id}`}
                          className="font-semibold text-[#8b10b8] hover:underline"
                        >
                          Order #{o.number}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(o.createdAt)}
                        </p>
                        {o.policyNumber ? (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-900 ring-1 ring-amber-100">
                            <Hash className="h-3 w-3" />
                            {o.policyNumber}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          color={o.paymentStatus === "PAID" ? "green" : "amber"}
                        >
                          {o.paymentStatus}
                        </Badge>
                        {o.policyNumber ? (
                          <Badge
                            color={
                              o.underwritingStatus === "SENT" ? "green" : "teal"
                            }
                          >
                            UW {o.underwritingStatus.replace(/_/g, " ")}
                          </Badge>
                        ) : null}
                        <span className="text-sm font-bold text-slate-900">
                          {formatCurrency(Number(o.total))}
                        </span>
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-3">
                      {o.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between text-sm text-slate-700"
                        >
                          <span>
                            {item.name.split(" · ")[0] || item.name}{" "}
                            <span className="text-slate-400">
                              × {item.quantity}
                            </span>
                          </span>
                          <span className="font-medium">
                            {formatCurrency(Number(item.lineTotal))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section id="tickets" title="Tickets" icon={Ticket} accent="sky" flush>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5 font-semibold">#</th>
                    <th className="px-4 py-2.5 font-semibold">Subject</th>
                    <th className="px-4 py-2.5 font-semibold">Stage</th>
                    <th className="px-5 py-2.5 font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-50 transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/tickets/${t.id}`}
                          className="font-medium text-[#8b10b8] hover:underline"
                        >
                          #{t.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-800">{t.subject}</td>
                      <td className="px-4 py-3">
                        <Badge color="teal">{t.stage.name}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {formatDate(t.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {customer.tickets.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-slate-500">
                        No tickets yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            id="conversations"
            title="Inbox history"
            icon={MessageSquare}
            accent="violet"
          >
            {customer.conversations.length === 0 ? (
              <Empty>No inbox threads linked yet</Empty>
            ) : (
              <div className="space-y-2">
                {customer.conversations.map((c) => {
                  const last = c.messages[0];
                  return (
                    <Link
                      key={c.id}
                      href="/inbox"
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3.5 py-3 transition hover:border-[rgba(172,22,224,0.15)] hover:bg-[rgba(172,22,224,0.08)]/40"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge color="teal">{c.channel}</Badge>
                          <span className="truncate text-sm font-medium text-slate-900">
                            {c.subject || c.externalRef || "Conversation"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {last?.body || "No messages"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {formatDateTime(c.lastMessageAt)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </Section>

          <Section id="deals" title="Deals" icon={Briefcase} accent="teal">
            {customer.deals.length === 0 ? (
              <Empty>No deals yet</Empty>
            ) : (
              <div className="space-y-2">
                {customer.deals.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3.5 py-3 text-sm transition hover:bg-slate-50/80"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{d.title}</p>
                      <p className="text-xs text-slate-500">
                        {d.stage?.name || "—"}
                      </p>
                    </div>
                    <span className="font-bold text-[#8b10b8]">
                      {formatCurrency(Number(d.value || 0))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-5 xl:sticky xl:top-14 xl:self-start">
          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-br from-[#f6f3fb]/80 to-transparent px-4 py-3">
              <User className="h-4 w-4 text-[#8b10b8]" />
              <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
            </div>
            <dl className="space-y-3 p-4 text-sm">
              {customer.address ? (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Address
                  </dt>
                  <dd className="mt-0.5 flex gap-1.5 text-slate-700">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {customer.address}
                  </dd>
                </div>
              ) : null}
              {customer.company ? (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Company
                  </dt>
                  <dd className="mt-0.5 flex gap-1.5 text-slate-700">
                    <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {customer.company.name}
                  </dd>
                </div>
              ) : null}
              {customer.source ? (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Source
                  </dt>
                  <dd className="mt-0.5 text-slate-700">{customer.source}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Customer since
                </dt>
                <dd className="mt-0.5 text-slate-700">
                  {formatDate(customer.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section
            id="documents"
            className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
          >
            <CustomerDocuments
              customerId={customer.id}
              documents={customer.attachments.map((a) => ({
                id: a.id,
                label: a.label,
                fileName: a.fileName,
                mimeType: a.mimeType,
                size: a.size,
                createdAt: a.createdAt.toISOString(),
              }))}
              compact
            />
          </section>

          <section
            id="notes"
            className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
            </div>
            <div className="space-y-3 p-4">
              <form action={addNoteAction} className="space-y-2">
                <input type="hidden" name="customerId" value={customer.id} />
                <Label htmlFor="body" className="sr-only">
                  Add note
                </Label>
                <Textarea
                  id="body"
                  name="body"
                  rows={2}
                  required
                  placeholder="Internal note…"
                  className="text-sm"
                />
                <Button type="submit" size="sm" className="h-8 w-full">
                  Save note
                </Button>
              </form>
              <div className="max-h-64 space-y-2 overflow-y-auto border-t border-slate-100 pt-3">
                {customer.notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
                  >
                    <p className="text-xs text-slate-800">{n.body}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {formatDateTime(n.createdAt)}
                    </p>
                  </div>
                ))}
                {customer.notes.length === 0 && (
                  <Empty>No notes yet</Empty>
                )}
              </div>
            </div>
          </section>

          <section
            id="activity"
            className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
            </div>
            <div className="max-h-96 space-y-0 overflow-y-auto p-4">
              {customer.activities.map((a, i) => (
                <div key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < customer.activities.length - 1 ? (
                    <span className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-slate-200" />
                  ) : null}
                  <span className="relative z-[1] mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#ac16e0] bg-white" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">
                      {a.title}
                    </p>
                    {a.body ? (
                      <p className="mt-0.5 text-[11px] text-slate-600">{a.body}</p>
                    ) : null}
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {formatDateTime(a.createdAt)}
                      {a.user?.name ? ` · ${a.user.name}` : ""}
                    </p>
                  </div>
                </div>
              ))}
              {customer.activities.length === 0 && (
                <Empty>No activity yet</Empty>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
