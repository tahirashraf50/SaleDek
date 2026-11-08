import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { assertModuleAccess } from "@/lib/modules";
import { formatCurrency, formatDate } from "@/lib/utils";
import { listOperationsAssignees } from "@/server/actions/operations";
import { OperationsAssign } from "@/components/operations/operations-assign";
import { OperationsCaseForm } from "@/components/operations/operations-case-form";

type Props = { params: Promise<{ orderId: string }> };

export default async function OperationsCasePage({ params }: Props) {
  const session = await requireOrgSession();
  await assertModuleAccess(session, "OPERATIONS");
  const { orderId } = await params;

  const [order, agents] = await Promise.all([
    db.order.findFirst({
      where: { id: orderId, organizationId: session.organizationId },
      include: {
        customer: true,
        items: true,
        operationsAssignee: { select: { name: true } },
      },
    }),
    listOperationsAssignees(),
  ]);
  if (!order) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/operations"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Operations queue
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Order #{order.number}
          </h1>
          <p className="text-sm text-slate-500">
            {order.customer.name} · {formatCurrency(Number(order.total))} ·{" "}
            {formatDate(order.createdAt)}
            {order.policyNumber ? ` · Policy ${order.policyNumber}` : ""}
          </p>
        </div>
        <OperationsAssign
          orderId={order.id}
          assigneeId={order.operationsAssigneeId}
          agents={agents}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Activation / handoff
          </h2>
          <OperationsCaseForm
            orderId={order.id}
            status={order.operationsStatus}
            note={order.operationsNote}
          />
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 text-sm shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="font-semibold text-slate-900">Customer</p>
          <Link
            href={`/customers/${order.customer.id}`}
            className="text-[#8b10b8] hover:underline"
          >
            {order.customer.name}
          </Link>
          <p className="text-xs text-slate-500">
            Assignee: {order.operationsAssignee?.name || "Unassigned"}
          </p>
          <p className="text-xs text-slate-500">
            UW: {order.underwritingStatus} · Pay: {order.paymentStatus}
          </p>
          <ul className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
            {order.items.map((i) => (
              <li key={i.id}>{i.name.split(" · ")[0]}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
