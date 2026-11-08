import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentStatus } from "@prisma/client";
import { ArrowLeft, CheckCircle2, Clock3, UserRound } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { parseOrderFormValues } from "@/lib/product-form";
import { confirmPayment, markInstallmentPaid } from "@/server/actions/sales";
import { verifyAndConfirmPayment } from "@/server/actions/payments-verify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Props = { params: Promise<{ id: string }> };

async function confirmPaymentAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("orderId"));
  const paymentId = String(formData.get("paymentId"));
  const status =
    (String(formData.get("status") || "PAID") as PaymentStatus) || "PAID";
  await confirmPayment(orderId, paymentId, {
    reference: String(formData.get("reference") || "") || undefined,
    notes: String(formData.get("notes") || "") || undefined,
    status,
  });
}

async function verifyPaymentAction(formData: FormData) {
  "use server";
  await verifyAndConfirmPayment({
    orderId: String(formData.get("orderId")),
    paymentId: String(formData.get("paymentId")),
    reference: String(formData.get("reference") || ""),
    autoConfirm: true,
  });
}

async function markInstallmentAction(formData: FormData) {
  "use server";
  await markInstallmentPaid(
    String(formData.get("orderId")),
    String(formData.get("installmentId")),
    String(formData.get("reference") || "") || undefined
  );
}

function statusColor(status: string): "green" | "amber" | "red" | "default" {
  if (status === "PAID" || status === "CLEARED") return "green";
  if (status === "BOUNCED" || status === "CANCELLED" || status === "OVERDUE")
    return "red";
  if (status === "PARTIAL" || status === "RECEIVED" || status === "PENDING")
    return "amber";
  return "default";
}

function paymentConfirmed(status: string) {
  return status === "PAID" || status === "CLEARED";
}

export default async function OrderDetailPage({ params }: Props) {
  const session = await requireOrgSession();
  const { id } = await params;

  const order = await db.order.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      customer: {
        include: { company: { select: { name: true } } },
      },
      items: true,
      payments: { orderBy: { createdAt: "asc" } },
      installments: { orderBy: { number: "asc" } },
      createdBy: { select: { name: true } },
    },
  });

  if (!order) notFound();

  const paid = paymentConfirmed(order.paymentStatus);
  const pendingPayments = order.payments.filter(
    (p) => !paymentConfirmed(p.status)
  );
  const policyDoc = await db.attachment.findFirst({
    where: {
      customerId: order.customerId,
      ticketId: null,
      label: `Policy summary — Order #${order.number}`,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/sales/orders"
            className="inline-flex items-center gap-1.5 text-sm text-[#8b10b8] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Orders
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              Order #{order.number}
            </h1>
            <Badge color={statusColor(order.status)}>Order {order.status}</Badge>
            <Badge color={statusColor(order.paymentStatus)}>
              Payment {order.paymentStatus}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(order.createdAt)}
            {order.createdBy?.name ? ` · by ${order.createdBy.name}` : ""}
            {" · "}
            {order.paymentMethod}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Order total
          </p>
          <p className="text-2xl font-semibold text-[#8b10b8]">
            {formatCurrency(Number(order.total))}
          </p>
          <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-slate-500">
            {paid ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Payment confirmed
              </>
            ) : (
              <>
                <Clock3 className="h-3.5 w-3.5 text-amber-600" />
                Awaiting confirmation
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/customers/${order.customerId}`}
              className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100 transition hover:bg-[rgba(172,22,224,0.08)]/50 hover:ring-[rgba(172,22,224,0.3)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ac16e0] text-sm font-semibold text-white">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {order.customer.name}
                </p>
                <p className="text-sm text-slate-500">
                  {[order.customer.phone, order.customer.email]
                    .filter(Boolean)
                    .join(" · ") || "No contact"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {[
                    order.customer.cnic ? `CNIC ${order.customer.cnic}` : null,
                    order.customer.company?.name,
                    order.customer.city,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Open full profile →"}
                </p>
              </div>
            </Link>
            {order.notes ? (
              <p className="mt-3 rounded-lg bg-amber-50/80 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-100">
                <span className="font-medium">Notes: </span>
                {order.notes}
              </p>
            ) : null}
            {policyDoc ? (
              <a
                href={`/api/attachments/${policyDoc.id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-[#8b10b8] hover:underline"
              >
                Download policy PDF →
              </a>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatCurrency(Number(order.subtotal))} />
            <Row label="Discount" value={formatCurrency(Number(order.discount))} />
            <Row label="Tax" value={formatCurrency(Number(order.tax))} />
            <div className="border-t border-slate-100 pt-2">
              <Row
                label="Total"
                value={formatCurrency(Number(order.total))}
                strong
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Line items &amp; policy details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item) => {
            const fields = parseOrderFormValues(item.formValues);
            const baseName = item.name.split(" · ")[0] || item.name;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{baseName}</p>
                    <p className="text-xs text-slate-500">
                      Qty {item.quantity} · Unit{" "}
                      {formatCurrency(Number(item.unitPrice))}
                      {Number(item.taxPercent) > 0
                        ? ` · Tax ${Number(item.taxPercent)}%`
                        : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(Number(item.lineTotal))}
                  </p>
                </div>
                {fields.length > 0 ? (
                  <dl className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((f) => (
                      <div
                        key={`${f.label}-${f.value}`}
                        className="rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-100"
                      >
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {f.label}
                        </dt>
                        <dd className="text-sm text-slate-900">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : item.name.includes(" · ") ? (
                  <p className="mt-2 text-xs text-slate-500">{item.name}</p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {order.payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Payments</CardTitle>
              {pendingPayments.length > 0 ? (
                <span className="text-xs text-amber-700">
                  {pendingPayments.length} awaiting confirmation
                </span>
              ) : (
                <span className="text-xs text-emerald-700">All confirmed</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.payments.map((p) => {
              const done = paymentConfirmed(p.status);
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {formatCurrency(Number(p.amount))}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {p.method}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                        {p.paidAt ? ` · ${formatDateTime(p.paidAt)}` : ""}
                      </p>
                    </div>
                    <Badge color={statusColor(p.status)}>{p.status}</Badge>
                  </div>
                  {p.notes ? (
                    <p className="mt-2 text-xs text-slate-500">{p.notes}</p>
                  ) : null}

                  {!done && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                      <form
                        action={confirmPaymentAction}
                        className="grid gap-2 sm:grid-cols-[7rem_1fr_1fr_auto]"
                      >
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="paymentId" value={p.id} />
                        <div>
                          <Label className="text-[11px]">Status</Label>
                          <Select name="status" defaultValue="PAID" className="h-9">
                            <option value="PAID">PAID</option>
                            <option value="CLEARED">CLEARED</option>
                            <option value="RECEIVED">RECEIVED</option>
                            <option value="BOUNCED">BOUNCED</option>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[11px]">Reference</Label>
                          <Input
                            name="reference"
                            className="h-9"
                            placeholder="Txn / cheque ref"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px]">Notes</Label>
                          <Input name="notes" className="h-9" placeholder="Optional" />
                        </div>
                        <div className="flex items-end">
                          <Button type="submit" size="sm" className="w-full sm:w-auto">
                            Confirm payment
                          </Button>
                        </div>
                      </form>

                      <details className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <summary className="cursor-pointer text-xs font-medium text-slate-600">
                          Sandbox verify (optional)
                        </summary>
                        <form
                          action={verifyPaymentAction}
                          className="mt-2 flex flex-wrap gap-2"
                        >
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="paymentId" value={p.id} />
                          <Input
                            name="reference"
                            required
                            className="h-9 min-w-[12rem] flex-1"
                            placeholder={
                              order.paymentMethod === "JAZZCASH"
                                ? "JC-OK-123456"
                                : order.paymentMethod === "BANK"
                                  ? "BANKREF01"
                                  : "CHQ-001"
                            }
                          />
                          <Button type="submit" size="sm" variant="secondary">
                            Verify &amp; pay
                          </Button>
                        </form>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {order.installments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Installments</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Due</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {order.installments.map((inst) => (
                  <tr key={inst.id} className="border-b border-slate-100">
                    <td className="px-4 py-2.5 font-medium">#{inst.number}</td>
                    <td className="px-4 py-2.5">
                      {formatCurrency(Number(inst.amount))}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {formatDate(inst.dueDate)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge color={statusColor(inst.status)}>{inst.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {inst.status !== "PAID" ? (
                        <form
                          action={markInstallmentAction}
                          className="inline-flex items-center gap-2"
                        >
                          <input type="hidden" name="orderId" value={order.id} />
                          <input
                            type="hidden"
                            name="installmentId"
                            value={inst.id}
                          />
                          <Input
                            name="reference"
                            placeholder="Ref"
                            className="h-8 w-28"
                          />
                          <Button type="submit" size="sm" variant="outline">
                            Mark paid
                          </Button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {inst.paidAt ? formatDate(inst.paidAt) : "Paid"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          strong ? "text-base font-semibold text-[#8b10b8]" : "font-medium text-slate-900"
        }
      >
        {value}
      </span>
    </div>
  );
}
