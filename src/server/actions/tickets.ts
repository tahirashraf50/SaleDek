"use server";

import { revalidatePath } from "next/cache";
import {
  TicketChannel,
  TicketPriority,
  TicketStageKey,
} from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { writeAudit } from "@/lib/audit";
import { applySlaToTicket } from "@/lib/sla";
import { runAutomations } from "@/lib/automation";
import { notifyUser } from "@/lib/notifications";
import { createCustomer } from "@/server/actions/customers";

export async function createTicket(input: {
  customerId?: string;
  newCustomer?: {
    name: string;
    phone?: string;
    email?: string;
    cnic?: string;
    address?: string;
    city?: string;
  };
  subject: string;
  description: string;
  priority: TicketPriority;
  channel: TicketChannel;
  typeId?: string;
  departmentId?: string;
  assigneeId?: string;
  productId?: string;
  forwardNote?: string;
  conversationId?: string;
}) {
  const session = await requirePerm("tickets:write");
  const organizationId = session.organizationId;

  let customerId = input.customerId;
  if (!customerId && input.newCustomer?.name) {
    const c = await createCustomer(input.newCustomer);
    customerId = c.id;
  }
  if (!customerId) throw new Error("Customer required");

  const stageKey: TicketStageKey = input.departmentId ? "FORWARDED" : "NEW";
  const stage = await db.ticketStage.findFirst({
    where: { organizationId, key: stageKey },
  });
  if (!stage) throw new Error("Ticket stages not configured");

  const org = await db.organization.update({
    where: { id: organizationId },
    data: { ticketCounter: { increment: 1 } },
  });

  const ticket = await db.ticket.create({
    data: {
      organizationId,
      number: org.ticketCounter,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      channel: input.channel,
      stageId: stage.id,
      typeId: input.typeId || null,
      customerId,
      departmentId: input.departmentId || null,
      assigneeId: input.assigneeId || null,
      createdById: session.user.id,
      productId: input.productId || null,
      conversationId: input.conversationId || null,
    },
    include: { type: true },
  });

  if (input.forwardNote) {
    await db.ticketNote.create({
      data: {
        ticketId: ticket.id,
        authorId: session.user.id,
        body: input.forwardNote,
        isInternal: true,
      },
    });
  }

  await applySlaToTicket({
    organizationId,
    ticketId: ticket.id,
    priority: input.priority,
    typeId: input.typeId,
  });

  await logActivity({
    organizationId,
    userId: session.user.id,
    customerId,
    ticketId: ticket.id,
    type: "TICKET",
    title: `Ticket #${ticket.number} created`,
    body: ticket.subject,
  });

  await writeAudit({
    organizationId,
    userId: session.user.id,
    action: "ticket.create",
    entity: "Ticket",
    entityId: ticket.id,
  });

  await runAutomations({
    organizationId,
    trigger: "TICKET_CREATED",
    ticketId: ticket.id,
    context: {
      priority: ticket.priority,
      typeName: ticket.type?.name || "",
      typeId: ticket.typeId || "",
      channel: ticket.channel,
      departmentId: ticket.departmentId || "",
    },
  });

  if (ticket.assigneeId && ticket.assigneeId !== session.user.id) {
    await notifyUser({
      organizationId,
      userId: ticket.assigneeId,
      title: `Assigned ticket #${ticket.number}`,
      body: ticket.subject,
      href: `/tickets/${ticket.id}`,
    });
  }

  if (ticket.departmentId) {
    const { notifyDepartmentOfTicket } = await import("@/lib/department-notify");
    await notifyDepartmentOfTicket({
      organizationId,
      ticketId: ticket.id,
      departmentId: ticket.departmentId,
      note: input.forwardNote,
      forwardedByName: session.user.name || undefined,
    });
  }

  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  revalidatePath("/department");
  revalidatePath("/inbox");
  return ticket;
}

export async function updateTicketStage(
  ticketId: string,
  stageKey: TicketStageKey,
  resolutionNote?: string
) {
  const session = await requirePerm("tickets:write");
  const organizationId = session.organizationId;

  const stage = await db.ticketStage.findFirst({
    where: { organizationId, key: stageKey },
  });
  if (!stage) throw new Error("Invalid stage");

  const existing = await db.ticket.findFirst({
    where: { id: ticketId, organizationId },
    include: { stage: true },
  });
  if (!existing) throw new Error("Not found");

  const data: Record<string, unknown> = { stageId: stage.id };
  if (stageKey === "RESOLVED" || stageKey === "CLOSED") {
    data.resolvedAt = existing.resolvedAt || new Date();
    if (stageKey === "CLOSED") data.closedAt = new Date();
    if (resolutionNote) data.resolutionNote = resolutionNote;
    await db.slaTimer.updateMany({
      where: { ticketId, resolveMetAt: null },
      data: { resolveMetAt: new Date() },
    });
  }
  if (stageKey === "REOPENED") {
    data.resolvedAt = null;
    data.closedAt = null;
  }

  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data,
  });

  await logActivity({
    organizationId,
    userId: session.user.id,
    customerId: ticket.customerId,
    ticketId,
    type: "STATUS_CHANGE",
    title: `Stage: ${existing.stage.name} → ${stage.name}`,
    body: resolutionNote,
  });

  await runAutomations({
    organizationId,
    trigger: "TICKET_STAGE_CHANGED",
    ticketId,
    context: {
      stageKey,
      priority: ticket.priority,
      departmentId: ticket.departmentId || "",
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  return ticket;
}

export async function forwardTicket(
  ticketId: string,
  departmentId: string,
  note?: string,
  assigneeId?: string
) {
  const session = await requirePerm("tickets:assign");
  const organizationId = session.organizationId;
  const existing = await db.ticket.findFirst({
    where: { id: ticketId, organizationId },
  });
  if (!existing) throw new Error("Ticket not found");

  const stage = await db.ticketStage.findFirst({
    where: { organizationId, key: "FORWARDED" },
  });

  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: {
      departmentId,
      assigneeId: assigneeId || null,
      stageId: stage?.id,
    },
  });

  if (note) {
    await db.ticketNote.create({
      data: {
        ticketId,
        authorId: session.user.id,
        body: note,
        isInternal: true,
      },
    });
  }

  await logActivity({
    organizationId,
    userId: session.user.id,
    customerId: ticket.customerId,
    ticketId,
    type: "FORWARD",
    title: "Ticket forwarded",
    body: note,
  });

  const { notifyDepartmentOfTicket } = await import("@/lib/department-notify");
  await notifyDepartmentOfTicket({
    organizationId,
    ticketId,
    departmentId,
    note,
    forwardedByName: session.user.name || undefined,
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/department");
  revalidatePath("/inbox");
  return ticket;
}

export async function escalateTicket(ticketId: string, reason: string) {
  const session = await requirePerm("tickets:escalate");
  const organizationId = session.organizationId;
  const stage = await db.ticketStage.findFirst({
    where: { organizationId, key: "ESCALATED" },
  });

  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { stageId: stage?.id },
  });

  await db.ticketNote.create({
    data: {
      ticketId,
      authorId: session.user.id,
      body: `Escalation: ${reason}`,
      isInternal: true,
    },
  });

  await logActivity({
    organizationId,
    userId: session.user.id,
    customerId: ticket.customerId,
    ticketId,
    type: "ESCALATE",
    title: "Ticket escalated",
    body: reason,
  });

  revalidatePath(`/tickets/${ticketId}`);
  return ticket;
}

export async function updateTicketPriority(
  ticketId: string,
  priority: TicketPriority
) {
  const session = await requirePerm("tickets:write");
  const existing = await db.ticket.findFirst({
    where: { id: ticketId, organizationId: session.organizationId },
  });
  if (!existing) throw new Error("Not found");

  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { priority },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: ticket.customerId,
    ticketId,
    type: "STATUS_CHANGE",
    title: `Priority → ${priority}`,
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return ticket;
}

export async function assignTicket(ticketId: string, assigneeId: string | null) {
  const session = await requirePerm("tickets:assign");
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { assigneeId },
  });

  if (!ticket.firstRespondedAt && assigneeId) {
    await db.ticket.update({
      where: { id: ticketId },
      data: { firstRespondedAt: new Date() },
    });
    await db.slaTimer.updateMany({
      where: { ticketId, firstMetAt: null },
      data: { firstMetAt: new Date() },
    });
  }

  if (assigneeId) {
    await notifyUser({
      organizationId: session.organizationId,
      userId: assigneeId,
      title: `Assigned ticket #${ticket.number}`,
      href: `/tickets/${ticketId}`,
    });
  }

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: ticket.customerId,
    ticketId,
    type: "ASSIGNMENT",
    title: assigneeId ? "Ticket assigned" : "Ticket unassigned",
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return ticket;
}

export async function addTicketNote(
  ticketId: string,
  body: string,
  isInternal = true
) {
  // Customer-visible replies go through central sendCustomerReply (channel + inbox sync).
  if (!isInternal) {
    const { sendCustomerReply } = await import("@/server/actions/replies");
    const result = await sendCustomerReply({
      ticketId,
      body,
      isInternal: false,
    });
    return { id: result.noteId || result.messageId || ticketId };
  }

  const session = await requirePerm("tickets:write");
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, organizationId: session.organizationId },
  });
  if (!ticket) throw new Error("Not found");

  const note = await db.ticketNote.create({
    data: {
      ticketId,
      authorId: session.user.id,
      body,
      isInternal: true,
    },
  });

  await logActivity({
    organizationId: session.organizationId,
    userId: session.user.id,
    customerId: ticket.customerId,
    ticketId,
    type: "NOTE",
    title: "Internal note",
    body,
  });

  revalidatePath(`/tickets/${ticketId}`);
  return note;
}

export async function submitCsat(ticketId: string, rating: number, comment?: string) {
  const session = await requirePerm("tickets:write");
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, organizationId: session.organizationId },
  });
  if (!ticket) throw new Error("Not found");

  const csat = await db.csatResponse.create({
    data: {
      ticketId,
      customerId: ticket.customerId,
      rating,
      comment,
    },
  });
  revalidatePath(`/tickets/${ticketId}`);
  return csat;
}

export async function linkTickets(
  fromTicketId: string,
  toTicketId: string,
  linkType = "related"
) {
  const session = await requirePerm("tickets:write");
  await db.ticketLink.create({
    data: { fromTicketId, toTicketId, linkType },
  });
  revalidatePath(`/tickets/${fromTicketId}`);
}
