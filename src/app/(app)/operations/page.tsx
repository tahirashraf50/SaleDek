import Link from "next/link";
import { ClipboardCheck, Cog } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { assertModuleAccess } from "@/lib/modules";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { listOperationsAssignees } from "@/server/actions/operations";
import { OperationsAssign } from "@/components/operations/operations-assign";

type Props = { searchParams: Promise<{ status?: string }> };

const CHIPS = [
  { id: "", label: "Open" },
  { id: "PENDING", label: "Pending" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

export default async function OperationsQueuePage({ searchParams }: Props) {
  const session = await requireOrgSession();
  await assertModuleAccess(session, "OPERATIONS");
  const params = await searchParams;
  const status = params.status;

  const [orders, agents, pending, progress, done] = await Promise.all([
    db.order.findMany({
      where: {
        organizationId: session.organizationId,
        ...(status
          ? {
              operationsStatus: status as "PENDING" | "IN_PROGRESS" | "DONE",
            }
          : { operationsStatus: { in: ["PENDING", "IN_PROGRESS"] } }),
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
      include: {
        customer: { select: { id: true, name: true } },
        operationsAssignee: { select: { id: true, name: true } },
        items: { select: { name: true }, take: 1 },
      },
    }),
    listOperationsAssignees(),
    db.order.count({
      where: {
        organizationId: session.organizationId,
        operationsStatus: "PENDING",
      },
    }),
    db.order.count({
      where: {
        organizationId: session.organizationId,
        operationsStatus: "IN_PROGRESS",
      },
    }),
    db.order.count({
      where: {
        organizationId: session.organizationId,
        operationsStatus: "DONE",
      },
    }),
  ]);

  function href(s: string) {
    return s ? `/operations?status=${s}` : "/operations";
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
          Operations
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Activate / handoff after policy or payment · {pending + progress} open
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Pending", value: pending, color: "text-amber-600" },
          { label: "In progress", value: progress, color: "text-sky-600" },
          { label: "Done", value: done, color: "text-emerald-600" },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
          >
            <p className="text-sm text-slate-500">{k.label}</p>
            <p className={cn("mt-1 text-2xl font-bold", k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-sm bg-violet-600" />
            <Cog className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">Cases</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => {
              const active = (status || "") === c.id;
              return (
                <Link
                  key={c.id || "open"}
                  href={href(active && c.id ? "" : c.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                    active
                      ? "bg-violet-600 text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-slate-50/90"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">Order #{o.number}</p>
                  <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 ring-1 ring-violet-100">
                    {o.operationsStatus}
                  </span>
                  {o.policyNumber ? (
                    <span className="font-mono text-[10px] font-semibold text-amber-800">
                      {o.policyNumber}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  <Link
                    href={`/customers/${o.customer.id}`}
                    className="font-medium text-slate-700 hover:underline"
                  >
                    {o.customer.name}
                  </Link>
                  {" · "}
                  {o.items[0]?.name.split(" · ")[0] || "—"}
                  {" · "}
                  {formatDate(o.createdAt)} · {formatCurrency(Number(o.total))}
                </p>
              </div>
              <OperationsAssign
                orderId={o.id}
                assigneeId={o.operationsAssigneeId}
                agents={agents}
                compact
              />
              <Link
                href={`/operations/${o.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                Open
              </Link>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="px-5 py-16 text-center text-sm text-slate-500">
              No operations cases in this view.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
