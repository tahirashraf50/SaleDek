import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Mail,
  Phone,
  Shield,
  ShoppingCart,
  User,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { parseOrderFormValues } from "@/lib/product-form";
import { UnderwritingCaseForm } from "@/components/underwriting/underwriting-case-form";
import { UnderwritingAssign } from "@/components/underwriting/underwriting-assign";
import { listUnderwritingAssignees } from "@/server/actions/underwriting";
import { assertModuleAccess } from "@/lib/modules";

type Props = { params: Promise<{ orderId: string }> };

const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-900",
  IN_REVIEW: "border-sky-200 bg-sky-50 text-sky-900",
  POLICY_READY: "border-violet-200 bg-violet-50 text-violet-900",
  SENT: "border-emerald-200 bg-emerald-50 text-emerald-900",
};

export default async function UnderwritingCasePage({ params }: Props) {
  const session = await requireOrgSession();
  await assertModuleAccess(session, "UNDERWRITING");
  const { orderId } = await params;

  const [order, agents] = await Promise.all([
    db.order.findFirst({
      where: { id: orderId, organizationId: session.organizationId },
      include: {
        customer: true,
        items: true,
        createdBy: { select: { name: true } },
        ticket: { select: { id: true, number: true } },
        underwritingAssignee: { select: { id: true, name: true } },
        attachments: {
          where: { label: { startsWith: "Policy —" } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    listUnderwritingAssignees(),
  ]);
  if (!order) notFound();

  const policyDoc = order.attachments[0] || null;

  return (
    <div className="-m-5 flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden md:-m-7">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-4 py-2.5 md:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/underwriting"
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
                STATUS_STYLE[order.underwritingStatus] || STATUS_STYLE.PENDING
              )}
            >
              <Shield className="h-3 w-3" />
              {order.underwritingStatus.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {order.customer.name} · {formatCurrency(Number(order.total))} ·{" "}
            {formatDate(order.createdAt)}
            {order.policyNumber ? (
              <>
                {" "}
                · <span className="font-mono font-medium text-slate-700">{order.policyNumber}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UnderwritingAssign
            orderId={order.id}
            assigneeId={order.underwritingAssigneeId}
            agents={agents}
          />
          {policyDoc ? (
            <a
              href={`/api/attachments/${policyDoc.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(172,22,224,0.25)] bg-[rgba(172,22,224,0.08)] px-2.5 py-1.5 text-[11px] font-semibold text-[#8b10b8] hover:bg-[rgba(172,22,224,0.12)]"
              target="_blank"
              rel="noreferrer"
            >
              <FileText className="h-3.5 w-3.5" />
              Download policy
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 md:p-4 xl:grid-cols-[minmax(0,1.4fr)_320px]">
        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <div className="shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-3.5 py-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Underwriting
              </h2>
            </div>
            <div className="p-3">
              <UnderwritingCaseForm
                orderId={order.id}
                policyNumber={order.policyNumber}
                underwritingStatus={order.underwritingStatus}
                customerEmail={order.customer.email}
                hasDocument={Boolean(policyDoc)}
                documentLabel={policyDoc?.label}
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
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
                        {item.name}
                      </p>
                      <p className="text-xs font-semibold text-slate-800">
                        {formatCurrency(Number(item.lineTotal))}
                      </p>
                    </div>
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

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto xl:overflow-hidden">
          <div className="shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-br from-amber-50/80 to-transparent px-3.5 py-2">
              <User className="h-3.5 w-3.5 text-amber-700" />
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
                <p className="text-[11px] text-rose-600">
                  No email — add on profile before send.
                </p>
              )}
              {order.customer.cnic ? (
                <p className="text-[11px] text-slate-500">
                  CNIC {order.customer.cnic}
                </p>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-3.5 py-2">
              <h2 className="text-sm font-semibold text-slate-900">Case meta</h2>
            </div>
            <dl className="space-y-1.5 overflow-y-auto p-3 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Payment</dt>
                <dd className="font-medium text-slate-900">
                  {order.paymentMethod} · {order.paymentStatus}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Assigned agent</dt>
                <dd className="font-medium text-slate-900">
                  {order.underwritingAssignee?.name || "Unassigned"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Created by</dt>
                <dd className="font-medium text-slate-900">
                  {order.createdBy?.name || "—"}
                </dd>
              </div>
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
              {order.policyIssuedAt ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Issued</dt>
                  <dd className="text-slate-800">
                    {formatDateTime(order.policyIssuedAt)}
                  </dd>
                </div>
              ) : null}
              {order.policySentAt ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Emailed</dt>
                  <dd className="text-slate-800">
                    {formatDateTime(order.policySentAt)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
