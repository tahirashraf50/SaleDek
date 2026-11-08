"use server";

import { revalidatePath } from "next/cache";
import { TicketStageKey } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export async function bulkAssignTickets(ticketIds: string[], assigneeId: string | null) {
  const session = await requirePerm("tickets:assign");
  await db.ticket.updateMany({
    where: {
      id: { in: ticketIds },
      organizationId: session.organizationId,
    },
    data: { assigneeId },
  });
  revalidatePath("/tickets");
}

export async function bulkUpdateTicketStage(
  ticketIds: string[],
  stageKey: TicketStageKey
) {
  const session = await requirePerm("tickets:write");
  const stage = await db.ticketStage.findFirst({
    where: { organizationId: session.organizationId, key: stageKey },
  });
  if (!stage) throw new Error("Invalid stage");

  await db.ticket.updateMany({
    where: {
      id: { in: ticketIds },
      organizationId: session.organizationId,
    },
    data: { stageId: stage.id },
  });

  for (const id of ticketIds.slice(0, 20)) {
    const t = await db.ticket.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!t) continue;
    await logActivity({
      organizationId: session.organizationId,
      userId: session.user.id,
      customerId: t.customerId,
      ticketId: id,
      type: "STATUS_CHANGE",
      title: `Bulk stage → ${stage.name}`,
    });
  }

  revalidatePath("/tickets");
}

export async function saveTicketView(name: string, filters: object, isShared = false) {
  const session = await requirePerm("tickets:read");
  const view = await db.savedView.create({
    data: {
      organizationId: session.organizationId,
      userId: session.user.id,
      name,
      entity: "tickets",
      filters,
      isShared,
    },
  });
  revalidatePath("/tickets");
  return view;
}

export async function deleteSavedView(id: string) {
  const session = await requirePerm("tickets:read");
  await db.savedView.deleteMany({
    where: {
      id,
      organizationId: session.organizationId,
      OR: [{ userId: session.user.id }, { isShared: true }],
    },
  });
  revalidatePath("/tickets");
}
