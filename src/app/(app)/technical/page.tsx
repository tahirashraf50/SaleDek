import Link from "next/link";
import { Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { assertModuleAccess } from "@/lib/modules";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function TechnicalQueuePage() {
  const session = await requireOrgSession();
  const mod = await assertModuleAccess(session, "TECHNICAL");
  const orgId = session.organizationId;

  // Prefer tickets in the assigned Technical department; fall back to all open
  const deptId = mod.departmentId;

  const ticketWhere = {
    organizationId: orgId,
    stage: { isTerminal: false },
    ...(deptId ? { departmentId: deptId } : {}),
  };

  const [tickets, openCount, agents] = await Promise.all([
    db.ticket.findMany({
      where: ticketWhere,
      orderBy: { updatedAt: "desc" },
      take: 80,
      include: {
        customer: { select: { id: true, name: true } },
        stage: { select: { name: true, key: true } },
        assignee: { select: { name: true } },
        type: { select: { name: true } },
      },
    }),
    db.ticket.count({ where: ticketWhere }),
    deptId
      ? db.user.findMany({
          where: { organizationId: orgId, departmentId: deptId, active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Also surface Product-type tickets not yet in dept (if module has a dept)
  const productExtras =
    deptId
      ? await db.ticket.findMany({
          where: {
            organizationId: orgId,
            stage: { isTerminal: false },
            OR: [
              { type: { name: { equals: "Product" } } },
              { subject: { contains: "technical" } },
            ],
            NOT: { departmentId: deptId },
          },
          take: 20,
          include: {
            customer: { select: { id: true, name: true } },
            stage: { select: { name: true } },
            assignee: { select: { name: true } },
            type: { select: { name: true } },
          },
        })
      : [];

  const seen = new Set(tickets.map((t) => t.id));
  const merged = [
    ...tickets,
    ...productExtras.filter((t) => !seen.has(t.id)),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
          Technical
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Technical department ticket queue · {openCount} open
          {mod.department?.name ? ` · ${mod.department.name}` : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Open tickets</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Dept agents</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{agents.length}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <span className="h-4 w-1 rounded-sm bg-sky-500" />
          <Wrench className="h-4 w-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">Tickets</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {merged.map((t) => (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/90"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">#{t.number}</p>
                  <Badge color="teal">{t.stage.name}</Badge>
                  {t.type?.name ? (
                    <span className="text-[10px] font-medium text-slate-500">
                      {t.type.name}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-800">
                  {t.subject}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.customer?.name || "No customer"}
                  {t.assignee?.name ? ` · ${t.assignee.name}` : " · Unassigned"}
                  {" · "}
                  {formatDate(t.createdAt)}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-lg px-2 py-1 text-[10px] font-semibold",
                  t.priority === "URGENT" || t.priority === "HIGH"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-50 text-slate-600"
                )}
              >
                {t.priority}
              </span>
            </Link>
          ))}
          {merged.length === 0 && (
            <p className="px-5 py-16 text-center text-sm text-slate-500">
              No open technical tickets. Assign the Technical module to a
              department and forward tickets there.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
