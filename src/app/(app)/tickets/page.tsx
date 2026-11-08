import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  LayoutGrid,
  List,
  Search,
  UserRound,
  UserX,
} from "lucide-react";
import { Prisma, TicketPriority } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TicketBoard } from "@/components/tickets/ticket-board";
import { TicketsNewButton } from "@/components/tickets/tickets-new-button";
import { cn } from "@/lib/utils";

type Props = {
  searchParams: Promise<{
    stage?: string;
    assignee?: string;
    q?: string;
    view?: string;
    priority?: string;
  }>;
};

export default async function TicketsPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const viewMode = params.view === "kanban" ? "kanban" : "list";

  const baseWhere: Prisma.TicketWhereInput = {
    organizationId: session.organizationId,
  };
  if (session.user.role === "DEPARTMENT_USER" && session.user.departmentId) {
    baseWhere.departmentId = session.user.departmentId;
  }

  const [stages, users, savedViews, stageGroups, priorityGroups, unassignedCount, mineCount, totalAll] =
    await Promise.all([
      db.ticketStage.findMany({
        where: { organizationId: session.organizationId },
        orderBy: { position: "asc" },
      }),
      db.user.findMany({
        where: { organizationId: session.organizationId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.savedView.findMany({
        where: {
          organizationId: session.organizationId,
          entity: "tickets",
          OR: [{ userId: session.user.id }, { isShared: true }],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.ticket.groupBy({
        by: ["stageId"],
        where: baseWhere,
        _count: true,
      }),
      db.ticket.groupBy({
        by: ["priority"],
        where: {
          ...baseWhere,
          stage: { isTerminal: false },
        },
        _count: true,
      }),
      db.ticket.count({
        where: {
          ...baseWhere,
          assigneeId: null,
          stage: { isTerminal: false },
        },
      }),
      db.ticket.count({
        where: {
          ...baseWhere,
          assigneeId: session.user.id,
          stage: { isTerminal: false },
        },
      }),
      db.ticket.count({ where: baseWhere }),
    ]);

  const stageCount = Object.fromEntries(
    stageGroups.map((r) => [r.stageId, r._count])
  ) as Record<string, number>;
  const openCount = stages
    .filter((s) => !s.isTerminal)
    .reduce((sum, s) => sum + (stageCount[s.id] || 0), 0);
  const urgentHigh =
    (priorityGroups.find((p) => p.priority === "URGENT")?._count || 0) +
    (priorityGroups.find((p) => p.priority === "HIGH")?._count || 0);

  const where: Prisma.TicketWhereInput = { ...baseWhere };

  if (params.stage) {
    const match = stages.find(
      (s) => s.key === params.stage || s.id === params.stage
    );
    if (match) where.stageId = match.id;
  }
  if (params.assignee === "me") where.assigneeId = session.user.id;
  else if (params.assignee === "unassigned") where.assigneeId = null;
  else if (params.assignee) where.assigneeId = params.assignee;

  if (
    params.priority &&
    ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(params.priority)
  ) {
    where.priority =
      params.priority === "HIGH"
        ? { in: ["HIGH", "URGENT"] }
        : (params.priority as TicketPriority);
  }

  if (params.q?.trim()) {
    where.OR = [
      { subject: { contains: params.q, mode: "insensitive" } },
      { customer: { name: { contains: params.q, mode: "insensitive" } } },
      ...(Number.isFinite(Number(params.q))
        ? [{ number: Number(params.q) }]
        : []),
    ];
  }

  const tickets = await db.ticket.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      stage: true,
      customer: { select: { id: true, name: true, phone: true } },
      assignee: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      type: { select: { id: true, name: true } },
    },
  });

  const serialized = tickets.map((t) => ({
    ...t,
    updatedAt: t.updatedAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
  }));

  function href(next: {
    stage?: string;
    assignee?: string;
    q?: string;
    view?: string;
    priority?: string;
  }) {
    const qs = new URLSearchParams();
    const stage = next.stage !== undefined ? next.stage : params.stage;
    const assignee =
      next.assignee !== undefined ? next.assignee : params.assignee;
    const q = next.q !== undefined ? next.q : params.q;
    const view = next.view !== undefined ? next.view : viewMode;
    const priority =
      next.priority !== undefined ? next.priority : params.priority;
    if (stage) qs.set("stage", stage);
    if (assignee) qs.set("assignee", assignee);
    if (q) qs.set("q", q);
    if (priority) qs.set("priority", priority);
    if (view && view !== "list") qs.set("view", view);
    const s = qs.toString();
    return s ? `/tickets?${s}` : "/tickets";
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Tickets
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Complaints & service queue · {tickets.length}
            {params.q || params.stage || params.assignee || params.priority
              ? " matching"
              : " shown"}
            {totalAll !== tickets.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <Link
              href={href({ view: "list" })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "list"
                  ? "bg-[#ac16e0] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </Link>
            <Link
              href={href({ view: "kanban" })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                viewMode === "kanban"
                  ? "bg-[#ac16e0] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </Link>
          </div>
          <TicketsNewButton />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Open tickets</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{openCount}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {totalAll} total all-time
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ac16e0] text-white shadow-md shadow-[0_10px_24px_-12px_rgba(172,22,224,0.35)]">
              <ClipboardList className="h-4 w-4" />
            </span>
          </div>
        </div>
        <Link
          href={href({ priority: params.priority === "HIGH" ? "" : "HIGH", stage: "" })}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition hover:border-rose-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Urgent / high</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{urgentHigh}</p>
              <p className="mt-1 text-[11px] text-slate-400">Needs attention</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
        </Link>
        <Link
          href={href({
            assignee: params.assignee === "unassigned" ? "" : "unassigned",
          })}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition hover:border-amber-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Unassigned</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {unassignedCount}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Open queue</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <UserX className="h-4 w-4" />
            </span>
          </div>
        </Link>
        <Link
          href={href({
            assignee: params.assignee === "me" ? "" : "me",
          })}
          className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] transition hover:border-sky-200"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Assigned to me</p>
              <p className="mt-1 text-2xl font-bold text-sky-600">{mineCount}</p>
              <p className="mt-1 text-[11px] text-slate-400">Your open work</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <UserRound className="h-4 w-4" />
            </span>
          </div>
        </Link>
      </div>

      <form
        action="/tickets"
        method="get"
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
      >
        {viewMode === "kanban" ? (
          <input type="hidden" name="view" value="kanban" />
        ) : null}
        {params.priority ? (
          <input type="hidden" name="priority" value={params.priority} />
        ) : null}
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={params.q || ""}
              placeholder="#, subject, or customer…"
              className="h-10 border-slate-200 bg-slate-50 pl-9 shadow-none"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            Stage
          </label>
          <Select
            name="stage"
            defaultValue={params.stage || ""}
            className="h-10 w-40"
          >
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">
            Assignee
          </label>
          <Select
            name="assignee"
            defaultValue={params.assignee || ""}
            className="h-10 w-44"
          >
            <option value="">Anyone</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline" className="h-10 bg-white">
          Apply
        </Button>
        {(params.q || params.stage || params.assignee || params.priority) && (
          <Link href={viewMode === "kanban" ? "/tickets?view=kanban" : "/tickets"}>
            <Button type="button" variant="ghost" className="h-10">
              Clear
            </Button>
          </Link>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href({ stage: "" })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
            !params.stage
              ? "bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          All stages
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px]",
              !params.stage
                ? "bg-white/20 text-white"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {totalAll}
          </span>
        </Link>
        {stages.map((s) => {
          const active = params.stage === s.key || params.stage === s.id;
          const count = stageCount[s.id] || 0;
          return (
            <Link
              key={s.id}
              href={href({ stage: active ? "" : s.key })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: active ? "rgba(255,255,255,0.85)" : s.color,
                }}
              />
              {s.name}
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

      <TicketBoard
        stages={stages}
        tickets={serialized}
        users={users}
        savedViews={savedViews}
        viewMode={viewMode}
        currentFilters={{
          stage: params.stage,
          assignee: params.assignee,
          q: params.q,
          priority: params.priority,
        }}
      />
    </div>
  );
}
