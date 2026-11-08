import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { assertModuleAccess } from "@/lib/modules";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function SalesDeskPage() {
  const session = await requireOrgSession();
  await assertModuleAccess(session, "SALES");
  const orgId = session.organizationId;

  const [deals, orders, openDeals, unpaidOrders] = await Promise.all([
    db.deal.findMany({
      where: {
        organizationId: orgId,
        stage: { isWon: false, isLost: false },
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        customer: { select: { id: true, name: true } },
        stage: { select: { name: true } },
        owner: { select: { name: true } },
      },
    }),
    db.order.findMany({
      where: {
        organizationId: orgId,
        paymentStatus: {
          in: ["PENDING", "PARTIAL", "OVERDUE", "RECEIVED"],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        items: { select: { name: true }, take: 1 },
      },
    }),
    db.deal.count({
      where: {
        organizationId: orgId,
        stage: { isWon: false, isLost: false },
      },
    }),
    db.order.count({
      where: {
        organizationId: orgId,
        paymentStatus: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
          Sales desk
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Open deals and follow-up orders for the sales department
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Open deals</p>
          <p className="mt-1 text-2xl font-bold text-[#8b10b8]">{openDeals}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Unpaid / follow-up orders</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{unpaidOrders}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
            <h2 className="text-base font-semibold text-slate-900">
              Pipeline deals
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {deals.map((d) => (
              <div key={d.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{d.title}</p>
                    <p className="text-xs text-slate-500">
                      <Link
                        href={`/customers/${d.customer.id}`}
                        className="hover:underline"
                      >
                        {d.customer.name}
                      </Link>
                      {" · "}
                      {d.stage?.name || "—"}
                      {d.owner?.name ? ` · ${d.owner.name}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[#8b10b8]">
                    {formatCurrency(Number(d.value || 0))}
                  </span>
                </div>
              </div>
            ))}
            {deals.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No open deals
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <span className="h-4 w-1 rounded-sm bg-amber-600" />
            <ShoppingCart className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">
              Follow-up orders
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/sales/orders/${o.id}`}
                className="block px-5 py-3 hover:bg-slate-50/90"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      Order #{o.number}
                    </p>
                    <p className="text-xs text-slate-500">
                      {o.customer.name} · {o.paymentStatus} ·{" "}
                      {formatDate(o.createdAt)}
                      {o.createdBy?.name ? ` · ${o.createdBy.name}` : ""}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-400">
                      {o.items[0]?.name.split(" · ")[0] || "—"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    {formatCurrency(Number(o.total))}
                  </span>
                </div>
              </Link>
            ))}
            {orders.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No follow-up orders
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
