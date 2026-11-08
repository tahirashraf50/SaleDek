import { AutomationTrigger, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";

type Condition = { field: string; op: string; value: string };
type Action =
  | { type: "assign_user"; userId: string }
  | { type: "assign_department"; departmentId: string }
  | { type: "set_priority"; priority: string }
  | { type: "notify_user"; userId: string; title?: string }
  | { type: "escalate" };

function matchConditions(conditions: Condition[], context: Record<string, unknown>) {
  if (!conditions?.length) return true;
  return conditions.every((c) => {
    const actual = String(context[c.field] ?? "");
    const expected = String(c.value ?? "");
    if (c.op === "eq") return actual === expected;
    if (c.op === "neq") return actual !== expected;
    if (c.op === "contains") return actual.toLowerCase().includes(expected.toLowerCase());
    return false;
  });
}

export async function runAutomations(params: {
  organizationId: string;
  trigger: AutomationTrigger;
  context: Record<string, unknown>;
  ticketId?: string;
}) {
  const rules = await db.automationRule.findMany({
    where: {
      organizationId: params.organizationId,
      trigger: params.trigger,
      active: true,
    },
  });

  for (const rule of rules) {
    const conditions = (rule.conditions as unknown as Condition[]) || [];
    if (!matchConditions(conditions, params.context)) continue;

    const actions = (rule.actions as unknown as Action[]) || [];
    for (const action of actions) {
      if (!params.ticketId) {
        if (action.type === "notify_user") {
          await notifyUser({
            organizationId: params.organizationId,
            userId: action.userId,
            title: action.title || rule.name,
            body: `Automation: ${rule.name}`,
          });
        }
        continue;
      }

      if (action.type === "assign_user") {
        await db.ticket.update({
          where: { id: params.ticketId },
          data: { assigneeId: action.userId },
        });
      }
      if (action.type === "assign_department") {
        const forwarded = await db.ticketStage.findFirst({
          where: { organizationId: params.organizationId, key: "FORWARDED" },
        });
        await db.ticket.update({
          where: { id: params.ticketId },
          data: {
            departmentId: action.departmentId,
            ...(forwarded ? { stageId: forwarded.id } : {}),
          },
        });
      }
      if (action.type === "set_priority") {
        await db.ticket.update({
          where: { id: params.ticketId },
          data: { priority: action.priority as never },
        });
      }
      if (action.type === "escalate") {
        const escalated = await db.ticketStage.findFirst({
          where: { organizationId: params.organizationId, key: "ESCALATED" },
        });
        if (escalated) {
          await db.ticket.update({
            where: { id: params.ticketId },
            data: { stageId: escalated.id },
          });
        }
      }
      if (action.type === "notify_user") {
        await notifyUser({
          organizationId: params.organizationId,
          userId: action.userId,
          title: action.title || rule.name,
          body: `Automation: ${rule.name}`,
          href: `/tickets/${params.ticketId}`,
        });
      }
    }
  }
}

export type { Condition, Action };
