import {
  Flag,
  GitBranch,
  Handshake,
  Ticket,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function SettingsPipelinesPage() {
  const session = await requireOrgSession();
  const orgId = session.organizationId;

  const [ticketStages, dealStages, openTickets, openDeals] = await Promise.all([
    db.ticketStage.findMany({
      where: { organizationId: orgId },
      orderBy: { position: "asc" },
      include: { _count: { select: { tickets: true } } },
    }),
    db.dealStage.findMany({
      where: { organizationId: orgId },
      orderBy: { position: "asc" },
      include: { _count: { select: { deals: true } } },
    }),
    db.ticket.count({
      where: { organizationId: orgId, stage: { isTerminal: false } },
    }),
    db.deal.count({
      where: {
        organizationId: orgId,
        stage: { isWon: false, isLost: false },
      },
    }),
  ]);

  const terminalTickets = ticketStages.filter((s) => s.isTerminal).length;
  const outcomeDeals = dealStages.filter((s) => s.isWon || s.isLost).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
          Pipelines
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ticket & deal stages that power queues and CRM boards
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Ticket stages</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {ticketStages.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {terminalTickets} terminal
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-white shadow-md shadow-sky-600/25">
              <Ticket className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Open tickets</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{openTickets}</p>
          <p className="mt-1 text-[11px] text-slate-400">In non-terminal stages</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Deal stages</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {dealStages.length}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {outcomeDeals} win/lose
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-600/25">
              <Handshake className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Open deals</p>
          <p className="mt-1 text-2xl font-bold text-[#ac16e0]">{openDeals}</p>
          <p className="mt-1 text-[11px] text-slate-400">In pipeline now</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-sky-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Ticket stages
              </h2>
            </div>
            <p className="text-xs text-slate-400">Service pipeline</p>
          </div>
          <div className="divide-y divide-slate-50 p-3">
            {ticketStages.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50/80"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                  {s.position}
                </div>
                <div
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color || "#64748b" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{s.name}</p>
                  <p className="text-[11px] text-slate-400">{s.key}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                    {s._count.tickets} tickets
                  </span>
                  {s.isTerminal ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                      <Flag className="h-3 w-3" />
                      Terminal
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-sky-600">
                      Open
                    </span>
                  )}
                </div>
              </div>
            ))}
            {ticketStages.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-slate-500">
                No ticket stages configured
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-emerald-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Deal stages
              </h2>
            </div>
            <p className="text-xs text-slate-400">Sales pipeline</p>
          </div>
          <div className="divide-y divide-slate-50 p-3">
            {dealStages.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50/80"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                  {s.position}
                </div>
                <div
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color || "#22c55e" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">{s.name}</p>
                  <p className="text-[11px] text-slate-400">{s.key}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                    {s._count.deals} deals
                  </span>
                  {s.isWon ? (
                    <span className="text-[10px] font-semibold text-emerald-600">
                      Won
                    </span>
                  ) : s.isLost ? (
                    <span className="text-[10px] font-semibold text-rose-600">
                      Lost
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#ac16e0]">
                      <GitBranch className="h-3 w-3" />
                      Open
                    </span>
                  )}
                </div>
              </div>
            ))}
            {dealStages.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-slate-500">
                No deal stages configured
              </p>
            )}
          </div>
        </div>
      </div>

      <p
        className={cn(
          "rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-center text-xs text-slate-500"
        )}
      >
        Stages are seeded per organization — contact an admin to change order or
        keys.
      </p>
    </div>
  );
}
