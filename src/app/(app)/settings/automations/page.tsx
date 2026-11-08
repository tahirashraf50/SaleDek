import Link from "next/link";
import {
  Bolt,
  Plus,
  Search,
  Workflow,
  Zap,
} from "lucide-react";
import { AutomationTrigger } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";
import {
  createAutomationRule,
  toggleAutomationRule,
} from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

const TRIGGERS: AutomationTrigger[] = [
  "TICKET_CREATED",
  "TICKET_STAGE_CHANGED",
  "SLA_AT_RISK",
  "SLA_BREACHED",
  "SALE_CREATED",
  "INSTALLMENT_OVERDUE",
  "MESSAGE_RECEIVED",
  "CALL_LOGGED",
];

const TRIGGER_LABEL: Record<string, string> = {
  TICKET_CREATED: "Ticket created",
  TICKET_STAGE_CHANGED: "Stage changed",
  SLA_AT_RISK: "SLA at risk",
  SLA_BREACHED: "SLA breached",
  SALE_CREATED: "Sale created",
  INSTALLMENT_OVERDUE: "Installment overdue",
  MESSAGE_RECEIVED: "Message received",
  CALL_LOGGED: "Call logged",
};

async function createAutomationAction(formData: FormData) {
  "use server";
  const actionType = String(formData.get("actionType"));
  const actionUserId = String(formData.get("actionUserId") || "");
  const actionDeptId = String(formData.get("actionDepartmentId") || "");
  const actionPriority = String(formData.get("actionPriority") || "HIGH");

  type ActionPayload =
    | { type: "assign_user"; userId: string }
    | { type: "assign_department"; departmentId: string }
    | { type: "set_priority"; priority: string }
    | { type: "notify_user"; userId: string; title?: string }
    | { type: "escalate" };

  let action: ActionPayload;
  switch (actionType) {
    case "assign_user":
      action = { type: "assign_user", userId: actionUserId };
      break;
    case "assign_department":
      action = { type: "assign_department", departmentId: actionDeptId };
      break;
    case "set_priority":
      action = { type: "set_priority", priority: actionPriority };
      break;
    case "notify_user":
      action = {
        type: "notify_user",
        userId: actionUserId,
        title: String(formData.get("name")),
      };
      break;
    default:
      action = { type: "escalate" };
  }

  await createAutomationRule({
    name: String(formData.get("name")),
    trigger: String(formData.get("trigger")) as AutomationTrigger,
    conditions: [
      {
        field: String(formData.get("condField")),
        op: String(formData.get("condOp")),
        value: String(formData.get("condValue")),
      },
    ],
    actions: [action],
  });
}

async function toggleAction(formData: FormData) {
  "use server";
  await toggleAutomationRule(
    String(formData.get("id")),
    formData.get("active") === "true"
  );
}

function actionSummary(actions: unknown): string {
  if (!Array.isArray(actions) || actions.length === 0) return "No action";
  const a = actions[0] as { type?: string };
  return (a.type || "action").replace(/_/g, " ");
}

function conditionSummary(conditions: unknown): string {
  if (!Array.isArray(conditions) || conditions.length === 0) return "Always";
  const c = conditions[0] as { field?: string; op?: string; value?: string };
  if (!c.field) return "Always";
  return `${c.field} ${c.op || "eq"} ${c.value || ""}`.trim();
}

export default async function SettingsAutomationsPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;

  const baseWhere = { organizationId: session.organizationId };

  const [rules, users, departments, totalAll, activeCount, inactiveCount] =
    await Promise.all([
      db.automationRule.findMany({
        where: {
          ...baseWhere,
          ...(statusFilter === "active" ? { active: true } : {}),
          ...(statusFilter === "inactive" ? { active: false } : {}),
          ...(query
            ? {
                name: { contains: query, mode: "insensitive" as const },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      }),
      db.user.findMany({
        where: { organizationId: session.organizationId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.department.findMany({
        where: { organizationId: session.organizationId, active: true },
        orderBy: { name: "asc" },
      }),
      db.automationRule.count({ where: baseWhere }),
      db.automationRule.count({ where: { ...baseWhere, active: true } }),
      db.automationRule.count({ where: { ...baseWhere, active: false } }),
    ]);

  function href(next: { q?: string; status?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const status = next.status !== undefined ? next.status : params.status;
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    const s = qs.toString();
    return s ? `/settings/automations?${s}` : "/settings/automations";
  }

  const statusChips = [
    { id: "", label: "All", count: totalAll },
    { id: "active", label: "Active", count: activeCount },
    { id: "inactive", label: "Inactive", count: inactiveCount },
  ];

  const triggerCoverage = new Set(rules.map((r) => r.trigger)).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Automations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Trigger → condition → action rules · {rules.length}
            {query || statusFilter ? " matching" : " shown"}
            {totalAll !== rules.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <form action="/settings/automations" method="get" className="flex gap-2">
          {statusFilter ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="Search rules…"
              defaultValue={query || ""}
              className="h-10 w-64 border-slate-200 bg-white pl-9 shadow-sm sm:w-72"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10 bg-white">
            Search
          </Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Rules</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} active · {inactiveCount} off
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-600/25">
              <Zap className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Active now</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Running on events</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Trigger types used</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{triggerCoverage}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            Of {TRIGGERS.length} available
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Departments</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">
            {departments.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Assignable targets</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusChips.map((f) => {
          const active = (statusFilter || "") === f.id;
          return (
            <Link
              key={f.id || "all"}
              href={href({ status: active && f.id ? "" : f.id })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-violet-600 text-white shadow-sm shadow-violet-600/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {f.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-violet-600" />
              <h2 className="text-base font-semibold text-slate-900">
                All rules
              </h2>
            </div>
            <p className="text-xs text-slate-400">Event-driven workflows</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Rule</th>
                  <th className="px-3 py-3 font-semibold">When</th>
                  <th className="px-3 py-3 font-semibold">Then</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      "border-b border-slate-50 transition hover:bg-slate-50/90",
                      !r.active && "opacity-70"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                          <Bolt className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {r.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {formatDate(r.createdAt)} ·{" "}
                            {conditionSummary(r.conditions)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-100">
                        {TRIGGER_LABEL[r.trigger] || r.trigger}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium capitalize text-violet-700 ring-1 ring-violet-100">
                        <Workflow className="h-3 w-3" />
                        {actionSummary(r.actions)}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {r.active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <form action={toggleAction} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          type="hidden"
                          name="active"
                          value={r.active ? "false" : "true"}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="h-8 bg-white text-xs"
                        >
                          {r.active ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Zap className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-800">
                          No automation rules
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Create a rule on the right to get started.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="h-fit overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:sticky xl:top-4">
          <div className="border-b border-slate-100 bg-gradient-to-br from-violet-50/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm shadow-violet-600/25">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  New rule
                </h2>
                <p className="text-[11px] text-slate-500">
                  When this happens → do that
                </p>
              </div>
            </div>
          </div>
          <form action={createAutomationAction} className="space-y-3.5 p-5">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Urgent → assign claims"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="trigger">Trigger</Label>
              <Select
                id="trigger"
                name="trigger"
                defaultValue="TICKET_CREATED"
                className="mt-1"
              >
                {TRIGGERS.map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABEL[t] || t}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="condField">If field</Label>
                <Input
                  id="condField"
                  name="condField"
                  placeholder="priority"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="condOp">Operator</Label>
                <Select id="condOp" name="condOp" defaultValue="eq" className="mt-1">
                  <option value="eq">equals</option>
                  <option value="neq">not equals</option>
                  <option value="contains">contains</option>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="condValue">Value</Label>
              <Input
                id="condValue"
                name="condValue"
                placeholder="HIGH"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="actionType">Action</Label>
              <Select
                id="actionType"
                name="actionType"
                defaultValue="set_priority"
                className="mt-1"
              >
                <option value="set_priority">Set priority</option>
                <option value="assign_user">Assign user</option>
                <option value="assign_department">Assign department</option>
                <option value="notify_user">Notify user</option>
                <option value="escalate">Escalate</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="actionUserId">User</Label>
              <Select
                id="actionUserId"
                name="actionUserId"
                defaultValue=""
                className="mt-1"
              >
                <option value="">—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="actionDepartmentId">Department</Label>
              <Select
                id="actionDepartmentId"
                name="actionDepartmentId"
                defaultValue=""
                className="mt-1"
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="actionPriority">Priority</Label>
              <Select
                id="actionPriority"
                name="actionPriority"
                defaultValue="HIGH"
                className="mt-1"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </Select>
            </div>
            <Button
              type="submit"
              className="w-full bg-violet-600 text-white hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Create rule
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
