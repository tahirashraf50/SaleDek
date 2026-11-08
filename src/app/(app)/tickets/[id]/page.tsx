import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TicketPriority, TicketStageKey } from "@prisma/client";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageSquare,
  Paperclip,
  Play,
  RotateCcw,
  Star,
  UserRound,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatDateTime } from "@/lib/utils";
import {
  assignTicket,
  escalateTicket,
  forwardTicket,
  submitCsat,
  updateTicketPriority,
  updateTicketStage,
} from "@/server/actions/tickets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KnowledgePanel } from "@/components/tickets/knowledge-panel";
import { AttachmentUploader } from "@/components/tickets/attachment-uploader";
import { TicketProcessPanel } from "@/components/tickets/ticket-process-panel";

type Props = { params: Promise<{ id: string }> };

async function updateStageAction(formData: FormData) {
  "use server";
  const ticketId = String(formData.get("ticketId"));
  const stageKey = String(formData.get("stageKey")) as TicketStageKey;
  const resolutionNote =
    String(formData.get("resolutionNote") || "") || undefined;
  await updateTicketStage(ticketId, stageKey, resolutionNote);
}

async function quickStageAction(formData: FormData) {
  "use server";
  const ticketId = String(formData.get("ticketId"));
  const stageKey = String(formData.get("stageKey")) as TicketStageKey;
  const resolutionNote =
    String(formData.get("resolutionNote") || "") || undefined;
  await updateTicketStage(ticketId, stageKey, resolutionNote);
}

async function forwardAction(formData: FormData) {
  "use server";
  const ticketId = String(formData.get("ticketId"));
  const departmentId = String(formData.get("departmentId"));
  const note = String(formData.get("note") || "") || undefined;
  const assigneeId = String(formData.get("assigneeId") || "") || undefined;
  await forwardTicket(ticketId, departmentId, note, assigneeId || undefined);
}

async function escalateAction(formData: FormData) {
  "use server";
  await escalateTicket(
    String(formData.get("ticketId")),
    String(formData.get("reason"))
  );
}

async function assignAction(formData: FormData) {
  "use server";
  const assigneeId = String(formData.get("assigneeId") || "");
  await assignTicket(String(formData.get("ticketId")), assigneeId || null);
}

async function priorityAction(formData: FormData) {
  "use server";
  await updateTicketPriority(
    String(formData.get("ticketId")),
    String(formData.get("priority")) as TicketPriority
  );
}

async function noteAction(formData: FormData) {
  "use server";
  const { sendCustomerReply } = await import("@/server/actions/replies");
  const isInternal = formData.get("isInternal") === "on";
  await sendCustomerReply({
    ticketId: String(formData.get("ticketId")),
    body: String(formData.get("body")),
    isInternal,
  });
}

async function csatAction(formData: FormData) {
  "use server";
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") || "") || undefined;
  await submitCsat(String(formData.get("ticketId")), rating, comment);
}

function priorityBadge(priority: string) {
  if (priority === "URGENT") return "red" as const;
  if (priority === "HIGH") return "amber" as const;
  if (priority === "LOW") return "default" as const;
  return "blue" as const;
}

function stageBadge(key: string) {
  if (key === "RESOLVED" || key === "CLOSED") return "green" as const;
  if (key === "ESCALATED") return "red" as const;
  if (key === "IN_PROGRESS") return "teal" as const;
  if (key === "WAITING_CUSTOMER") return "amber" as const;
  if (key === "FORWARDED") return "violet" as const;
  return "blue" as const;
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round((mins / 60) * 10) / 10;
  if (hours < 48) return `${hours}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

export default async function TicketDetailPage({ params }: Props) {
  const session = await requireOrgSession();
  const { id } = await params;

  const ticket = await db.ticket.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      stage: true,
      type: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          company: { select: { id: true, name: true } },
        },
      },
      department: true,
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      product: { select: { id: true, name: true } },
      notes: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { user: { select: { name: true } } },
      },
      csatResponses: { orderBy: { createdAt: "desc" }, take: 5 },
      attachments: { orderBy: { createdAt: "desc" } },
      slaTimers: {
        orderBy: { resolveDueAt: "asc" },
        take: 1,
        include: { policy: { select: { name: true } } },
      },
    },
  });

  if (!ticket) notFound();

  const [stages, departments, users] = await Promise.all([
    db.ticketStage.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { position: "asc" },
    }),
    db.department.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: {
        organizationId: session.organizationId,
        active: true,
        role: { in: ["AGENT", "MANAGER", "DEPARTMENT_USER", "ORG_ADMIN"] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  const currentIdx = stages.findIndex((s) => s.id === ticket.stageId);
  const sla = ticket.slaTimers[0];
  const ageMs = Date.now() - ticket.createdAt.getTime();

  type TimelineItem =
    | {
        kind: "note";
        id: string;
        at: Date;
        body: string;
        author: string;
        isInternal: boolean;
      }
    | {
        kind: "activity";
        id: string;
        at: Date;
        title: string;
        body: string | null;
        user: string;
      };

  const timeline: TimelineItem[] = [
    ...ticket.notes.map((n) => ({
      kind: "note" as const,
      id: n.id,
      at: n.createdAt,
      body: n.body,
      author: n.author?.name || "System",
      isInternal: n.isInternal,
    })),
    ...ticket.activities.map((a) => ({
      kind: "activity" as const,
      id: a.id,
      at: a.createdAt,
      title: a.title,
      body: a.body,
      user: a.user?.name || "System",
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const key = ticket.stage.key;
  const canStart =
    key === "NEW" || key === "TRIAGED" || key === "FORWARDED" || key === "REOPENED";
  const canResolve =
    key !== "RESOLVED" && key !== "CLOSED";
  const canReopen = key === "RESOLVED" || key === "CLOSED";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-[#8b10b8] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to tickets
        </Link>
        {ticket.conversationId ? (
          <Link
            href="/inbox"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b10b8] hover:underline"
          >
            <Inbox className="h-3.5 w-3.5" />
            Open in Inbox
          </Link>
        ) : null}
      </div>

      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-gradient-to-br from-[#f6f3fb]/70 via-white to-slate-50 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                  #{ticket.number}
                </span>
                <Badge color={stageBadge(ticket.stage.key)}>
                  {ticket.stage.name}
                </Badge>
                <Badge color={priorityBadge(ticket.priority)}>
                  {ticket.priority}
                </Badge>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {ticket.channel}
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                {ticket.subject}
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                <Link
                  href={`/customers/${ticket.customerId}`}
                  className="font-medium text-[#8b10b8] hover:underline"
                >
                  {ticket.customer.name}
                </Link>
                {ticket.customer.company ? (
                  <Link
                    href={`/companies/${ticket.customer.company.id}`}
                    className="inline-flex items-center gap-1 hover:text-slate-800"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    {ticket.customer.company.name}
                  </Link>
                ) : null}
                {ticket.type ? <span>{ticket.type.name}</span> : null}
                {ticket.product ? <span>{ticket.product.name}</span> : null}
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  Age {formatDuration(ageMs)}
                </span>
              </p>
            </div>

            {/* Quick process actions */}
            <div className="flex flex-wrap gap-2">
              {canStart ? (
                <form action={quickStageAction}>
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="stageKey" value="IN_PROGRESS" />
                  <Button type="submit" size="sm" className="gap-1.5">
                    <Play className="h-3.5 w-3.5" />
                    Start work
                  </Button>
                </form>
              ) : null}
              {canResolve ? (
                <form action={quickStageAction}>
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="stageKey" value="RESOLVED" />
                  <input
                    type="hidden"
                    name="resolutionNote"
                    value="Resolved from quick action"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resolve
                  </Button>
                </form>
              ) : null}
              {canReopen ? (
                <form action={quickStageAction}>
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <input type="hidden" name="stageKey" value="REOPENED" />
                  <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reopen
                  </Button>
                </form>
              ) : null}
            </div>
          </div>

          {/* Stage stepper */}
          <div className="mt-5 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1">
              {stages.map((s, i) => {
                const active = s.id === ticket.stageId;
                const done = currentIdx >= 0 && i < currentIdx;
                return (
                  <div key={s.id} className="flex items-center gap-1">
                    <form action={quickStageAction}>
                      <input type="hidden" name="ticketId" value={ticket.id} />
                      <input type="hidden" name="stageKey" value={s.key} />
                      <button
                        type="submit"
                        title={`Move to ${s.name}`}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
                          active
                            ? "bg-[#ac16e0] text-white shadow-sm"
                            : done
                              ? "bg-[rgba(172,22,224,0.12)] text-[#8b10b8] hover:bg-[rgba(172,22,224,0.18)]"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {s.name}
                      </button>
                    </form>
                    {i < stages.length - 1 ? (
                      <span className="h-px w-3 bg-slate-200" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          <MetaTile
            label="Assignee"
            value={
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-slate-400" />
                {ticket.assignee?.name || "Unassigned"}
              </span>
            }
          />
          <MetaTile
            label="Department"
            value={ticket.department?.name || "—"}
          />
          <MetaTile
            label="Created"
            value={formatDateTime(ticket.createdAt)}
          />
          <MetaTile
            label="Created by"
            value={ticket.createdBy?.name || "—"}
          />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          {/* Description */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
              <h2 className="text-base font-semibold text-slate-900">
                Description
              </h2>
            </div>
            <div className="px-5 py-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {ticket.description || "No description provided."}
              </p>
              {ticket.resolutionNote ? (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Resolution
                  </p>
                  <p className="mt-1 text-sm text-emerald-900">
                    {ticket.resolutionNote}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Composer + timeline */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Timeline
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Notes, replies & activity
                  </p>
                </div>
              </div>
              <MessageSquare className="h-4 w-4 text-slate-300" />
            </div>

            <form
              action={noteAction}
              className="space-y-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4"
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Label htmlFor="body" className="text-[11px]">
                Reply / work note
              </Label>
              <Textarea
                id="body"
                name="body"
                rows={3}
                required
                className="bg-white"
                placeholder={
                  ticket.conversationId
                    ? "Reply — uncheck Internal to send via linked Inbox channel"
                    : "Add a work note (link Inbox to reply on WhatsApp/Email)"
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    name="isInternal"
                    defaultChecked
                    className="rounded"
                  />
                  Internal note (staff only)
                </label>
                <Button type="submit" size="sm">
                  {ticket.conversationId ? "Send / post" : "Post note"}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                {ticket.conversationId
                  ? "Customer reply syncs Ticket + Inbox timelines."
                  : "No inbox thread linked — notes stay on this ticket."}
              </p>
            </form>

            <div className="divide-y divide-slate-50">
              {timeline.map((item) =>
                item.kind === "note" ? (
                  <div key={`n-${item.id}`} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        {item.author}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          item.isInternal
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                            : "bg-sky-50 text-sky-700 ring-1 ring-sky-100"
                        )}
                      >
                        {item.isInternal ? "Internal" : "Customer-visible"}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(item.at)}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">
                      {item.body}
                    </p>
                  </div>
                ) : (
                  <div
                    key={`a-${item.id}`}
                    className="bg-slate-50/40 px-5 py-2.5"
                  >
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">
                        {item.title}
                      </span>
                      {item.body ? (
                        <span className="text-slate-500"> — {item.body}</span>
                      ) : null}
                      <span className="text-slate-400">
                        {" "}
                        · {item.user} · {formatDateTime(item.at)}
                      </span>
                    </p>
                  </div>
                )
              )}
              {timeline.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-slate-400">
                  No notes or activity yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <TicketProcessPanel
            ticketId={ticket.id}
            currentStageKey={ticket.stage.key}
            currentAssigneeId={ticket.assigneeId}
            currentDepartmentId={ticket.departmentId}
            stages={stages}
            users={users}
            departments={departments}
            updateStageAction={updateStageAction}
            assignAction={assignAction}
            forwardAction={forwardAction}
            escalateAction={escalateAction}
          />

          {/* Priority + SLA */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Priority & SLA
              </h3>
            </div>
            <div className="space-y-3 p-4">
              <form action={priorityAction} className="flex gap-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <Select
                  name="priority"
                  defaultValue={ticket.priority}
                  className="flex-1"
                >
                  {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
                <Button type="submit" size="sm" variant="outline">
                  Set
                </Button>
              </form>

              {sla ? (
                <div className="space-y-2 rounded-xl bg-slate-50 px-3 py-3 text-xs">
                  <p className="font-semibold text-slate-700">
                    {sla.policy.name}
                  </p>
                  <SlaRow
                    label="First response"
                    due={sla.firstDueAt}
                    met={sla.firstMetAt}
                    breached={sla.firstBreached}
                  />
                  <SlaRow
                    label="Resolve"
                    due={sla.resolveDueAt}
                    met={sla.resolveMetAt}
                    breached={sla.resolveBreached}
                  />
                </div>
              ) : (
                <p className="text-xs text-slate-400">No SLA timer on this ticket</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div>
                  <p className="uppercase tracking-wide text-slate-400">
                    First response
                  </p>
                  <p className="mt-0.5 font-medium text-slate-800">
                    {ticket.firstRespondedAt
                      ? formatDateTime(ticket.firstRespondedAt)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-wide text-slate-400">
                    Resolved
                  </p>
                  <p className="mt-0.5 font-medium text-slate-800">
                    {ticket.resolvedAt
                      ? formatDateTime(ticket.resolvedAt)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer snapshot */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Customer</h3>
            </div>
            <div className="space-y-2 p-4 text-sm">
              <Link
                href={`/customers/${ticket.customer.id}`}
                className="font-semibold text-[#8b10b8] hover:underline"
              >
                {ticket.customer.name}
              </Link>
              {ticket.customer.phone ? (
                <p className="text-slate-600">{ticket.customer.phone}</p>
              ) : null}
              {ticket.customer.email ? (
                <p className="truncate text-slate-600">{ticket.customer.email}</p>
              ) : null}
              {ticket.customer.company ? (
                <Link
                  href={`/companies/${ticket.customer.company.id}`}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                >
                  <Building2 className="h-3 w-3" />
                  {ticket.customer.company.name}
                </Link>
              ) : null}
            </div>
          </div>

          {/* Inbox sync */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Inbox sync</h3>
            </div>
            <div className="p-4 text-sm">
              {ticket.conversationId ? (
                <>
                  <p className="text-slate-600">
                    Linked thread — Ticket and Inbox stay in sync.
                  </p>
                  <Link
                    href="/inbox"
                    className="mt-2 inline-flex items-center gap-1 font-medium text-[#8b10b8] hover:underline"
                  >
                    <Inbox className="h-3.5 w-3.5" />
                    Open conversation
                  </Link>
                </>
              ) : (
                <p className="text-slate-500">
                  No inbox thread linked. Create from Inbox to enable channel
                  replies.
                </p>
              )}
            </div>
          </div>

          {/* CSAT */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Star className="h-3.5 w-3.5 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900">CSAT</h3>
            </div>
            <div className="space-y-3 p-4">
              {ticket.csatResponses.map((c) => (
                <p key={c.id} className="text-sm text-slate-600">
                  ★ {c.rating}/5
                  {c.comment ? ` — ${c.comment}` : ""}
                </p>
              ))}
              <form action={csatAction} className="space-y-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <Select name="rating" defaultValue="5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} stars
                    </option>
                  ))}
                </Select>
                <Input name="comment" placeholder="Comment (optional)" />
                <Button type="submit" size="sm" variant="outline" className="w-full">
                  Submit CSAT
                </Button>
              </form>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <Paperclip className="h-3.5 w-3.5 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">
                Attachments
              </h3>
            </div>
            <AttachmentUploader
              embedded
              ticketId={ticket.id}
              attachments={ticket.attachments.map((a) => ({
                ...a,
                createdAt: a.createdAt.toISOString(),
              }))}
            />
          </div>

          <KnowledgePanel seedQuery={ticket.type?.name || ticket.subject} />
        </div>
      </div>
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-white px-5 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function SlaRow({
  label,
  due,
  met,
  breached,
}: {
  label: string;
  due: Date;
  met: Date | null;
  breached: boolean;
}) {
  const now = Date.now();
  const overdue = !met && due.getTime() < now;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={cn(
          "font-semibold",
          met
            ? "text-emerald-700"
            : breached || overdue
              ? "text-rose-600"
              : "text-slate-800"
        )}
      >
        {met
          ? `Met · ${formatDateTime(met)}`
          : `Due ${formatDateTime(due)}${breached || overdue ? " · breach" : ""}`}
      </span>
    </div>
  );
}
