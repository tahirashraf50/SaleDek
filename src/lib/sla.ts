import { TicketPriority } from "@prisma/client";
import { db } from "@/lib/db";
import { addMinutes } from "date-fns";

export async function applySlaToTicket(params: {
  organizationId: string;
  ticketId: string;
  priority: TicketPriority;
  typeId?: string | null;
}) {
  const policies = await db.slaPolicy.findMany({
    where: {
      organizationId: params.organizationId,
      active: true,
      OR: [
        { priority: params.priority, ticketTypeId: params.typeId ?? undefined },
        { priority: params.priority, ticketTypeId: null },
        { priority: null, ticketTypeId: null },
      ],
    },
    orderBy: { firstResponseMins: "asc" },
  });

  const policy =
    policies.find((p) => p.priority === params.priority && p.ticketTypeId === params.typeId) ||
    policies.find((p) => p.priority === params.priority && !p.ticketTypeId) ||
    policies[0];

  if (!policy) return null;

  const now = new Date();
  return db.slaTimer.create({
    data: {
      ticketId: params.ticketId,
      policyId: policy.id,
      firstDueAt: addMinutes(now, policy.firstResponseMins),
      resolveDueAt: addMinutes(now, policy.resolveMins),
    },
  });
}

export async function markSlaBreaches(organizationId: string) {
  const now = new Date();
  const timers = await db.slaTimer.findMany({
    where: {
      ticket: { organizationId },
      OR: [
        { firstBreached: false, firstMetAt: null, firstDueAt: { lt: now } },
        { resolveBreached: false, resolveMetAt: null, resolveDueAt: { lt: now } },
      ],
    },
    include: { ticket: true },
  });

  for (const timer of timers) {
    await db.slaTimer.update({
      where: { id: timer.id },
      data: {
        firstBreached:
          !timer.firstMetAt && timer.firstDueAt < now ? true : timer.firstBreached,
        resolveBreached:
          !timer.resolveMetAt && timer.resolveDueAt < now
            ? true
            : timer.resolveBreached,
      },
    });
  }

  return timers.length;
}
