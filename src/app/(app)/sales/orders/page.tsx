import Link from "next/link";
import {
  AlertCircle,
  Banknote,
  Clock3,
  Package,
  Search,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OrdersNewButton } from "@/components/sales/orders-new-button";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<{
    q?: string;
    payment?: string;
    status?: string;
    method?: string;
  }>;
};

const AVATAR = ["#ef1e1e", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ac16e0"];

const PAYMENT_FILTERS: { id: string; label: string }[] = [
  { id: "", label: "All payments" },
  { id: "PAID", label: "Paid" },
  { id: "PENDING", label: "Pending" },
  { id: "PARTIAL", label: "Partial" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "BOUNCED", label: "Bounced" },
];

function paymentColor(status: string) {
  if (status === "PAID" || status === "CLEARED") return "green" as const;
  if (status === "BOUNCED" || status === "OVERDUE" || status === "CANCELLED")
    return "red" as const;
  if (status === "PARTIAL" || status === "RECEIVED" || status === "PENDING")
    return "amber" as const;
  return "default" as const;
}

function orderStatusColor(status: string) {
  if (status === "PAID") return "green" as const;
  if (status === "CANCELLED") return "red" as const;
  if (status === "PARTIAL") return "amber" as const;
  return "default" as const;
}

function methodLabel(method: string) {
  if (method === "JAZZCASH") return "JazzCash";
  if (method === "BANK") return "Bank";
  if (method === "CHEQUE") return "Cheque";
  if (method === "INSTALLMENT") return "Installment";
  return method;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function OrdersPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();

  const paymentFilter =
    params.payment &&
    ["PAID", "PENDING", "PARTIAL", "OVERDUE", "BOUNCED", "RECEIVED", "CLEARED"].includes(
      params.payment
    )
      ? (params.payment as PaymentStatus)
      : undefined;

  const statusFilter =
    params.status &&
    ["PENDING", "PARTIAL", "PAID", "CANCELLED"].includes(params.status)
      ? (params.status as OrderStatus)
      : undefined;

  const methodFilter =
    params.method &&
    ["BANK", "JAZZCASH", "CHEQUE", "INSTALLMENT"].includes(params.method)
      ? (params.method as PaymentMethod)
      : undefined;

  const baseWhere: Prisma.OrderWhereInput = {
    organizationId: session.organizationId,
  };

  const where: Prisma.OrderWhereInput = {
    ...baseWhere,
    ...(paymentFilter
      ? paymentFilter === "PAID"
        ? { paymentStatus: { in: ["PAID", "CLEARED"] } }
        : paymentFilter === "PENDING"
          ? { paymentStatus: { in: ["PENDING", "RECEIVED"] } }
          : { paymentStatus: paymentFilter }
      : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(methodFilter ? { paymentMethod: methodFilter } : {}),
    ...(query
      ? {
          OR: [
            { customer: { name: { contains: query, mode: "insensitive" } } },
            { customer: { phone: { contains: query, mode: "insensitive" } } },
            { notes: { contains: query, mode: "insensitive" } },
            ...(Number.isFinite(Number(query))
              ? [{ number: Number(query) }]
              : []),
          ],
        }
      : {}),
  };

  const [
    orders,
    totalAll,
    paymentGroups,
    paidAgg,
    openAgg,
    overdueCount,
    methodGroups,
  ] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        customer: {
          select: { id: true, name: true, phone: true, city: true },
        },
        createdBy: { select: { name: true } },
        items: { select: { name: true, quantity: true }, take: 3 },
        _count: { select: { items: true, installments: true } },
      },
    }),
    db.order.count({ where: baseWhere }),
    db.order.groupBy({
      by: ["paymentStatus"],
      where: baseWhere,
      _count: true,
    }),
    db.order.aggregate({
      where: {
        ...baseWhere,
        paymentStatus: { in: ["PAID", "CLEARED"] },
      },
      _sum: { total: true },
      _count: true,
    }),
    db.order.aggregate({
      where: {
        ...baseWhere,
        paymentStatus: { in: ["PENDING", "RECEIVED", "PARTIAL", "OVERDUE"] },
        status: { not: "CANCELLED" },
      },
      _sum: { total: true },
      _count: true,
    }),
    db.order.count({
      where: { ...baseWhere, paymentStatus: "OVERDUE" },
    }),
    db.order.groupBy({
      by: ["paymentMethod"],
      where: baseWhere,
      _count: true,
    }),
  ]);

  const paymentCount = Object.fromEntries(
    paymentGroups.map((r) => [r.paymentStatus, r._count])
  ) as Record<string, number>;
  const paidCount =
    (paymentCount.PAID || 0) + (paymentCount.CLEARED || 0);
  const pendingCount =
    (paymentCount.PENDING || 0) + (paymentCount.RECEIVED || 0);
  const methodCount = Object.fromEntries(
    methodGroups.map((r) => [r.paymentMethod, r._count])
  ) as Record<string, number>;

  const collected = Number(paidAgg._sum.total || 0);
  const outstanding = Number(openAgg._sum.total || 0);

  function href(next: {
    q?: string;
    payment?: string;
    status?: string;
    method?: string;
  }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const payment =
      next.payment !== undefined ? next.payment : params.payment;
    const status = next.status !== undefined ? next.status : params.status;
    const method = next.method !== undefined ? next.method : params.method;
    if (q) qs.set("q", q);
    if (payment) qs.set("payment", payment);
    if (status) qs.set("status", status);
    if (method) qs.set("method", method);
    const s = qs.toString();
    return s ? `/sales/orders?${s}` : "/sales/orders";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Orders
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sales, payments & installments · {orders.length}
            {query || paymentFilter || statusFilter || methodFilter
              ? " matching"
              : " shown"}
            {totalAll !== orders.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/sales/orders" method="get" className="flex gap-2">
            {paymentFilter ? (
              <input type="hidden" name="payment" value={paymentFilter} />
            ) : null}
            {statusFilter ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            {methodFilter ? (
              <input type="hidden" name="method" value={methodFilter} />
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                name="q"
                placeholder="Search #, customer, phone…"
                defaultValue={query || ""}
                className="h-10 w-64 border-slate-200 bg-white pl-9 shadow-sm sm:w-72"
              />
            </div>
            <Button type="submit" variant="outline" className="h-10 bg-white">
              Search
            </Button>
          </form>
          <OrdersNewButton />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Collected</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatCurrency(collected)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {paidCount} paid orders
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1e1e] text-white shadow-md shadow-red-500/20">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
        </div>
        <Link
          href={href({
            payment: params.payment === "PENDING" ? "" : "PENDING",
          })}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition hover:border-amber-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Outstanding</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {formatCurrency(outstanding)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {openAgg._count} open · {pendingCount} pending
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Clock3 className="h-4 w-4" />
            </span>
          </div>
        </Link>
        <Link
          href={href({
            payment: params.payment === "OVERDUE" ? "" : "OVERDUE",
          })}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition hover:border-rose-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Overdue</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">
                {overdueCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Needs follow-up</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
        </Link>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">All orders</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {methodCount.INSTALLMENT || 0} installment plans
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <ShoppingCart className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PAYMENT_FILTERS.map((f) => {
          const active = (params.payment || "") === f.id;
          const count =
            f.id === ""
              ? totalAll
              : f.id === "PAID"
                ? paidCount
                : f.id === "PENDING"
                  ? pendingCount
                  : paymentCount[f.id] || 0;
          return (
            <Link
              key={f.id || "all"}
              href={href({ payment: active && f.id ? "" : f.id })}
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
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <form
          action="/sales/orders"
          method="get"
          className="flex w-full flex-wrap items-end gap-2"
        >
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {params.payment ? (
            <input type="hidden" name="payment" value={params.payment} />
          ) : null}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Order status
            </label>
            <Select
              name="status"
              defaultValue={params.status || ""}
              className="h-10 w-40"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Method
            </label>
            <Select
              name="method"
              defaultValue={params.method || ""}
              className="h-10 w-44"
            >
              <option value="">All methods</option>
              <option value="BANK">Bank</option>
              <option value="JAZZCASH">JazzCash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="INSTALLMENT">Installment</option>
            </Select>
          </div>
          <Button type="submit" variant="outline" className="h-10 bg-white">
            Apply
          </Button>
          {(query ||
            params.payment ||
            params.status ||
            params.method) && (
            <Link href="/sales/orders">
              <Button type="button" variant="ghost" className="h-10">
                Clear
              </Button>
            </Link>
          )}
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
            <h2 className="text-base font-semibold text-slate-900">
              All orders
            </h2>
          </div>
          <p className="text-xs text-slate-400">Click a row to open details</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-semibold">Order</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Items</th>
                <th className="px-3 py-3 font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Method</th>
                <th className="px-3 py-3 font-semibold">Order</th>
                <th className="px-3 py-3 font-semibold">Payment</th>
                <th className="px-5 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const itemPreview = o.items
                  .map((it) =>
                    it.quantity > 1 ? `${it.name} ×${it.quantity}` : it.name
                  )
                  .join(", ");
                const extra = o._count.items - o.items.length;
                return (
                  <tr
                    key={o.id}
                    className="border-b border-slate-50 transition hover:bg-slate-50/90"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/sales/orders/${o.id}`}
                        className="block min-w-0"
                      >
                        <p className="font-semibold text-slate-900 hover:text-[#ef1e1e]">
                          Order #{o.number}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {o.createdBy?.name
                            ? `by ${o.createdBy.name}`
                            : "No agent"}
                          {o._count.installments > 0
                            ? ` · ${o._count.installments} installments`
                            : ""}
                        </p>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <Link
                        href={`/customers/${o.customer.id}`}
                        className="flex items-center gap-2.5"
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                          style={{
                            backgroundColor: AVATAR[i % AVATAR.length],
                          }}
                        >
                          {initials(o.customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800 hover:text-[#ef1e1e]">
                            {o.customer.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {o.customer.phone || o.customer.city || "—"}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex max-w-[200px] items-start gap-1.5">
                        <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <p className="line-clamp-2 text-xs text-slate-600">
                          {itemPreview || "—"}
                          {extra > 0 ? ` +${extra} more` : ""}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(Number(o.total))}
                      </p>
                      {Number(o.discount) > 0 ? (
                        <p className="text-[10px] text-emerald-600">
                          −{formatCurrency(Number(o.discount))} discount
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-100">
                        <Banknote className="h-3 w-3 text-slate-400" />
                        {methodLabel(o.paymentMethod)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge color={orderStatusColor(o.status)}>
                        {o.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge color={paymentColor(o.paymentStatus)}>
                        {o.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {formatDate(o.createdAt)}
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <ShoppingCart className="h-6 w-6" />
                      </div>
                      <p className="font-semibold text-slate-800">
                        No orders found
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try another search, clear filters, or create a new sale.
                      </p>
                      <div className="mt-4">
                        <OrdersNewButton />
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
