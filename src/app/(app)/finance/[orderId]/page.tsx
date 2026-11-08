import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  ShoppingCart,
  User,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { assertModuleAccess } from "@/lib/modules";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { parseOrderFormValues } from "@/lib/product-form";
import { listFinanceAssignees } from "@/server/actions/finance";
import { FinanceAssign } from "@/components/finance/finance-assign";
import { FinanceCaseForm } from "@/components/finance/finance-case-form";

type Props = { params: Promise<{ orderId: string }> };

const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-900",
  IN_REVIEW: "border-sky-200 bg-sky-50 text-sky-900",
  CLEARED: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

const PAY_STYLE: Record<string, string> = {
  PENDING: "text-rose-700",
  PARTIAL: "text-amber-700",
  OVERDUE: "text-rose-800",
  BOUNCED: "text-rose-800",
  RECEIVED: "text-sky-700",
  PAID: "text-emerald-700",
  CLEARED: "text-emerald-700",
};

export default async function FinanceCasePage({ params }: Props) {
  const session = await requireOrgSession();
  await assertModuleAccess(session, "FINANCE");
  const { orderId } = await params;

  const [order, agents, activities] = await Promise.all([
    db.order.findFirst({
      where: { id: orderId, organizationId: session.organizationId },
      include: {
        customer: true,
        items: true,
        payments: {
          orderBy: { createdAt: "asc" },
          include: {
            confirmedBy: { select: { name: true } },
          },
        },
        installments: { orderBy: { number: "asc" } },
        financeAssignee: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        ticket: { select: { id: true, number: true } },
      },
    }),
    listFinanceAssignees(),
    db.activity.findMany({
      where: {
        organizationId: session.organizationId,
        orderId,
        type: { in: ["PAYMENT", "NOTE", "ASSIGNMENT", "STATUS_CHANGE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
  ]);
  if (!order) notFound();

  const productLabel =
    order.items[0]?.name.split(" · ")[0] || "Sale";

  return (
    <div className="-m-5 flex min-h-0 flex-col overflow-hidden max-xl:overflow-visible xl:h-[calc(100vh-3.5rem)] md:-m-7">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-4 py-2.5 md:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/finance"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-3 w-3" />
              Queue
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900">
              Order #{order.number}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                STATUS_STYLE[order.financeStatus] || STATUS_STYLE.PENDING
              )}
            >
              <Wallet className="h-3 w-3" />
              {order.financeStatus.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {order.customer.name} · {productLabel} ·{" "}
            {formatCurrency(Number(order.total))} · {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FinanceAssign
            orderId={order.id}
            assigneeId={order.financeAssigneeId}
            agents={agents}
          />
          <Link
            href={`/sales/orders/${order.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Full order
          </Link>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 p-3 max-xl:overflow-visible xl:overflow-hidden md:p-4 xl:grid-cols-[minmax(0,1.45fr)_320px]">
        <div className="flex min-h-0 flex-col gap-3 xl:overflow-hidden">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] xl:flex-1">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3.5 py-2">
              <Wallet className="h-3.5 w-3.5 text-[#8b10b8]" />
              <h2 className="text-sm font-semibold text-slate-900">
                Finance workspace
              </h2>
            </div>
            <div className="min-h-0 overflow-y-auto p-3 xl:flex-1">
              <FinanceCaseForm
                orderId={order.id}
                financeStatus={order.financeStatus}
                orderTotal={Number(order.total)}
                payments={order.payments.map((p) => ({
                  id: p.id,
                  amount: Number(p.amount),
                  status: p.status,
                  method: p.method,
                  reference: p.reference,
                  notes: p.notes,
                  paidAt: p.paidAt?.toISOString() || null,
                }))}
                installments={order.installments.map((i) => ({
                  id: i.id,
                  number: i.number,
                  amount: Number(i.amount),
                  status: i.status,
                  dueDate: i.dueDate.toISOString(),
                  reference: i.reference,
                  paidAt: i.paidAt?.toISOString() || null,
                }))}
              />
            </div>
          </div>

          <div className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] xl:max-h-[34%]">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3.5 py-2">
              <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Sale lines</h2>
              <span className="text-[11px] text-slate-400">
                {order.items.length}
              </span>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-slate-50 overflow-y-auto">
              {order.items.map((item) => {
                const fields = parseOrderFormValues(item.formValues);
                return (
                  <div key={item.id} className="px-3.5 py-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.name.split(" · ")[0]}
                      </p>
                      <p className="text-xs font-semibold text-slate-800">
                        {formatCurrency(Number(item.lineTotal))}
                      </p>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Qty {item.quantity} · {formatCurrency(Number(item.unitPrice))}{" "}
                      ea
                    </p>
                    {fields.length > 0 ? (
                      <dl className="mt-1.5 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                        {fields.map((f) => (
                          <div
                            key={`${f.label}-${f.value}`}
                            className="rounded-md bg-slate-50 px-2 py-1"
                          >
                            <dt className="text-[9px] font-medium uppercase tracking-wide text-slate-400">
                              {f.label}
                            </dt>
                            <dd className="truncate text-xs text-slate-900">
                              {f.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 xl:overflow-hidden">
          <div className="shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-br from-[#f6f3fb]/80 to-transparent px-3.5 py-2">
              <User className="h-3.5 w-3.5 text-[#8b10b8]" />
              <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
            </div>
            <div className="space-y-1.5 p-3 text-sm">
              <Link
                href={`/customers/${order.customer.id}`}
                className="font-semibold text-slate-900 hover:underline"
              >
                {order.customer.name}
              </Link>
              {order.customer.phone ? (
                <p className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Phone className="h-3 w-3 text-slate-400" />
                  {order.customer.phone}
                </p>
              ) : null}
              {order.customer.email ? (
                <p className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Mail className="h-3 w-3 text-slate-400" />
                  {order.customer.email}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">No email on file</p>
              )}
              {order.customer.cnic ? (
                <p className="text-[11px] text-slate-500">
                  CNIC {order.customer.cnic}
                </p>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-3.5 py-2">
              <h2 className="text-sm font-semibold text-slate-900">Case meta</h2>
            </div>
            <dl className="space-y-1.5 p-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Payment</dt>
                <dd className="font-medium text-slate-900">
                  {order.paymentMethod} ·{" "}
                  <span className={PAY_STYLE[order.paymentStatus] || ""}>
                    {order.paymentStatus}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Order status</dt>
                <dd className="font-medium text-slate-900">{order.status}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Subtotal / tax</dt>
                <dd className="font-medium text-slate-900">
                  {formatCurrency(Number(order.subtotal))} /{" "}
                  {formatCurrency(Number(order.tax))}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Assigned</dt>
                <dd className="font-medium text-slate-900">
                  {order.financeAssignee?.name || "Unassigned"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Created by</dt>
                <dd className="font-medium text-slate-900">
                  {order.createdBy?.name || "—"}
                </dd>
              </div>
              {order.policyNumber ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Policy #</dt>
                  <dd className="font-mono font-medium text-slate-900">
                    {order.policyNumber}
                  </dd>
                </div>
              ) : null}
              {order.ticket ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Ticket</dt>
                  <dd>
                    <Link
                      href={`/tickets/${order.ticket.id}`}
                      className="font-medium text-[#8b10b8] hover:underline"
                    >
                      #{order.ticket.number}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {order.notes ? (
                <div className="border-t border-slate-50 pt-2">
                  <dt className="text-slate-500">Sale notes</dt>
                  <dd className="mt-0.5 text-slate-700">{order.notes}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="shrink-0 border-b border-slate-100 px-3.5 py-2">
              <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {activities.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-slate-50 bg-slate-50/70 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">
                      {a.title}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {formatDateTime(a.createdAt)}
                    </span>
                  </div>
                  {a.body ? (
                    <p className="mt-0.5 text-[11px] text-slate-600">{a.body}</p>
                  ) : null}
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {a.user?.name || "System"} · {a.type.replace(/_/g, " ")}
                  </p>
                </div>
              ))}
              {activities.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No finance activity yet.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
