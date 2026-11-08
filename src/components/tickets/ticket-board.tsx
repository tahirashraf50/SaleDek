"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Bookmark,
  CheckSquare,
  ClipboardList,
  GripVertical,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { TicketStageKey } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  bulkAssignTickets,
  bulkUpdateTicketStage,
  saveTicketView,
} from "@/server/actions/tickets-bulk";
import { updateTicketStage } from "@/server/actions/tickets";
import { cn, formatDate } from "@/lib/utils";
import { TicketsNewButton } from "@/components/tickets/tickets-new-button";

type Stage = {
  id: string;
  key: TicketStageKey;
  name: string;
  color: string;
  position: number;
  isTerminal?: boolean;
};
type Ticket = {
  id: string;
  number: number;
  subject: string;
  priority: string;
  channel?: string;
  stageId: string;
  stage: Stage;
  customer: { id: string; name: string; phone?: string | null };
  assignee: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  type?: { id: string; name: string } | null;
  updatedAt: string | Date;
  createdAt?: string | Date;
};

type SavedView = { id: string; name: string; filters: unknown };

const AVATAR = ["#0d9488", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"];

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function priorityBadge(priority: string) {
  if (priority === "URGENT") return "red" as const;
  if (priority === "HIGH") return "amber" as const;
  if (priority === "LOW") return "default" as const;
  return "blue" as const;
}

function channelLabel(channel?: string) {
  if (!channel) return null;
  if (channel === "WHATSAPP") return "WhatsApp";
  if (channel === "WALK_IN") return "Walk-in";
  return channel.charAt(0) + channel.slice(1).toLowerCase();
}

export function TicketBoard({
  stages,
  tickets: initialTickets,
  users,
  savedViews,
  viewMode,
  currentFilters,
}: {
  stages: Stage[];
  tickets: Ticket[];
  users: { id: string; name: string }[];
  savedViews: SavedView[];
  viewMode: "list" | "kanban";
  currentFilters: {
    stage?: string;
    assignee?: string;
    q?: string;
    priority?: string;
  };
}) {
  const [tickets, setTickets] = useState(initialTickets);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [viewName, setViewName] = useState("");

  useEffect(() => {
    setTickets(initialTickets);
    setSelected(new Set());
  }, [initialTickets]);

  const byStage = useMemo(() => {
    const map: Record<string, Ticket[]> = {};
    for (const s of stages) map[s.id] = [];
    for (const t of tickets) {
      if (!map[t.stageId]) map[t.stageId] = [];
      map[t.stageId].push(t);
    }
    return map;
  }, [tickets, stages]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === tickets.length) setSelected(new Set());
    else setSelected(new Set(tickets.map((t) => t.id)));
  }

  function moveTicket(ticketId: string, stageKey: TicketStageKey) {
    const stage = stages.find((s) => s.key === stageKey);
    if (!stage) return;
    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId ? { ...t, stageId: stage.id, stage } : t
      )
    );
    start(async () => {
      try {
        await updateTicketStage(ticketId, stageKey);
        toast.success("Stage updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function onBulkAssign(assigneeId: string) {
    const ids = [...selected];
    if (!ids.length) return;
    start(async () => {
      try {
        await bulkAssignTickets(ids, assigneeId || null);
        setTickets((prev) =>
          prev.map((t) => {
            if (!ids.includes(t.id)) return t;
            if (!assigneeId) return { ...t, assignee: null };
            const user = users.find((u) => u.id === assigneeId);
            return user ? { ...t, assignee: user } : t;
          })
        );
        toast.success(`Assigned ${ids.length} tickets`);
        setSelected(new Set());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function onBulkStage(stageKey: string) {
    const ids = [...selected];
    if (!ids.length || !stageKey) return;
    start(async () => {
      try {
        await bulkUpdateTicketStage(ids, stageKey as TicketStageKey);
        const stage = stages.find((s) => s.key === stageKey)!;
        setTickets((prev) =>
          prev.map((t) =>
            ids.includes(t.id) ? { ...t, stageId: stage.id, stage } : t
          )
        );
        toast.success(`Updated ${ids.length} tickets`);
        setSelected(new Set());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function onSaveView() {
    if (!viewName.trim()) return;
    start(async () => {
      try {
        await saveTicketView(viewName.trim(), currentFilters, true);
        setViewName("");
        toast.success("View saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
            selected.size
              ? "bg-[rgba(172,22,224,0.08)] text-[#8b10b8]"
              : "bg-slate-50 text-slate-500"
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {selected.size} selected
        </span>
        <Select
          className="h-9 w-40"
          defaultValue=""
          onChange={(e) => {
            if (!e.target.value) return;
            onBulkAssign(e.target.value === "__none__" ? "" : e.target.value);
            e.target.value = "";
          }}
          disabled={!selected.size || pending}
        >
          <option value="">Bulk assign…</option>
          <option value="__none__">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select
          className="h-9 w-44"
          defaultValue=""
          onChange={(e) => {
            if (!e.target.value) return;
            onBulkStage(e.target.value);
            e.target.value = "";
          }}
          disabled={!selected.size || pending}
        >
          <option value="">Bulk stage…</option>
          {stages.map((s) => (
            <option key={s.id} value={s.key}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Bookmark className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-9 w-44 pl-8"
              placeholder="Save view name"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={onSaveView}
            disabled={pending || !viewName.trim()}
          >
            Save view
          </Button>
        </div>
      </div>

      {savedViews.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Saved
          </span>
          {savedViews.map((v) => {
            const f = v.filters as {
              stage?: string;
              assignee?: string;
              q?: string;
              priority?: string;
            };
            const params = new URLSearchParams();
            params.set("view", viewMode);
            if (f.stage) params.set("stage", f.stage);
            if (f.assignee) params.set("assignee", f.assignee);
            if (f.q) params.set("q", f.q);
            if (f.priority) params.set("priority", f.priority);
            return (
              <Link key={v.id} href={`/tickets?${params.toString()}`}>
                <Badge color="teal" className="hover:bg-[rgba(172,22,224,0.12)]">
                  {v.name}
                </Badge>
              </Link>
            );
          })}
        </div>
      )}

      {viewMode === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages
            .filter((s) => s.key !== "CLOSED")
            .map((stage) => (
              <div
                key={stage.id}
                className="w-[300px] shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/80 shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const ticketId = e.dataTransfer.getData("ticketId");
                  if (ticketId) moveTicket(ticketId, stage.key);
                }}
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-sm font-semibold text-slate-800">
                      {stage.name}
                    </span>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {byStage[stage.id]?.length || 0}
                  </span>
                </div>
                <div className="max-h-[68vh] space-y-2 overflow-y-auto p-2.5">
                  {(byStage[stage.id] || []).map((t, i) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("ticketId", t.id)
                      }
                      className="group cursor-grab rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:border-[rgba(172,22,224,0.25)] hover:shadow-md active:cursor-grabbing"
                    >
                      <div className="mb-2 flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggle(t.id)}
                          className="mt-1 rounded border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/tickets/${t.id}`}
                            className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-[#8b10b8]"
                          >
                            <span className="text-slate-400">#{t.number}</span>{" "}
                            {t.subject}
                          </Link>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {t.customer.name}
                            {t.customer.phone ? ` · ${t.customer.phone}` : ""}
                          </p>
                        </div>
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge color={priorityBadge(t.priority)}>
                            {t.priority}
                          </Badge>
                          {channelLabel(t.channel) ? (
                            <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100">
                              {channelLabel(t.channel)}
                            </span>
                          ) : null}
                        </div>
                        {t.assignee ? (
                          <div
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{
                              backgroundColor: AVATAR[i % AVATAR.length],
                            }}
                            title={t.assignee.name}
                          >
                            {initials(t.assignee.name)}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {(byStage[stage.id] || []).length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">
                      Drop tickets here
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
              <h2 className="text-base font-semibold text-slate-900">
                All tickets
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Click a row to open · drag-free stage move on the right
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">
                    <input
                      type="checkbox"
                      checked={
                        selected.size === tickets.length && tickets.length > 0
                      }
                      onChange={toggleAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">Ticket</th>
                  <th className="px-3 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Stage</th>
                  <th className="px-3 py-3 font-semibold">Priority</th>
                  <th className="px-3 py-3 font-semibold">Assignee</th>
                  <th className="px-3 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Move</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t, i) => (
                  <tr
                    key={t.id}
                    className={cn(
                      "border-b border-slate-50 transition hover:bg-slate-50/90",
                      selected.has(t.id) && "bg-[rgba(172,22,224,0.06)]"
                    )}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggle(t.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <Link href={`/tickets/${t.id}`} className="block min-w-0">
                        <p className="font-semibold text-slate-900 hover:text-[#8b10b8]">
                          <span className="text-slate-400">#{t.number}</span>{" "}
                          {t.subject}
                        </p>
                        <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                          {channelLabel(t.channel) ? (
                            <span>{channelLabel(t.channel)}</span>
                          ) : null}
                          {t.type?.name ? <span>· {t.type.name}</span> : null}
                          {t.department?.name ? (
                            <span>· {t.department.name}</span>
                          ) : null}
                        </p>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <Link
                        href={`/customers/${t.customer.id}`}
                        className="flex items-center gap-2.5"
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                          style={{
                            backgroundColor: AVATAR[i % AVATAR.length],
                          }}
                        >
                          {initials(t.customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800 hover:text-[#8b10b8]">
                            {t.customer.name}
                          </p>
                          {t.customer.phone ? (
                            <p className="truncate text-[11px] text-slate-400">
                              {t.customer.phone}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-100">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: t.stage.color }}
                        />
                        {t.stage.name}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge color={priorityBadge(t.priority)}>
                        {t.priority}
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5">
                      {t.assignee ? (
                        <span className="inline-flex items-center gap-2 text-xs text-slate-700">
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{
                              backgroundColor:
                                AVATAR[(i + 2) % AVATAR.length],
                            }}
                          >
                            {initials(t.assignee.name)}
                          </span>
                          {t.assignee.name}
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-500">
                      {formatDate(t.updatedAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <Select
                        className="h-8 w-36"
                        value={t.stage.key}
                        onChange={(e) =>
                          moveTicket(t.id, e.target.value as TicketStageKey)
                        }
                        disabled={pending}
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.key}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          {currentFilters.q ? (
                            <Search className="h-6 w-6" />
                          ) : (
                            <ClipboardList className="h-6 w-6" />
                          )}
                        </div>
                        <p className="font-semibold text-slate-800">
                          No tickets match
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Try clearing filters or create a new complaint ticket.
                        </p>
                        <div className="mt-4">
                          <TicketsNewButton />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
