"use server";

import { db } from "@/lib/db";
import { applySlaToTicket } from "@/lib/sla";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automation";

export async function portalSubmitComplaint(input: {
  orgSlug: string;
  name: string;
  phone?: string;
  email?: string;
  subject: string;
  description: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}) {
  const org = await db.organization.findUnique({ where: { slug: input.orgSlug } });
  if (!org) throw new Error("Organization not found");

  let customer = null as Awaited<ReturnType<typeof db.customer.findFirst>>;
  if (input.phone || input.email) {
    customer = await db.customer.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          input.phone ? { phone: input.phone } : undefined,
          input.email ? { email: { equals: input.email, mode: "insensitive" } } : undefined,
        ].filter(Boolean) as object[],
      },
    });
  }

  if (!customer) {
    customer = await db.customer.create({
      data: {
        organizationId: org.id,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        source: "Portal",
        status: "LEAD",
      },
    });
  }

  const stage = await db.ticketStage.findFirst({
    where: { organizationId: org.id, key: "NEW" },
  });
  if (!stage) throw new Error("Ticket stages not configured");

  const type = await db.ticketType.findFirst({
    where: { organizationId: org.id, name: "Other" },
  });

  const orgUpdated = await db.organization.update({
    where: { id: org.id },
    data: { ticketCounter: { increment: 1 } },
  });

  const ticket = await db.ticket.create({
    data: {
      organizationId: org.id,
      number: orgUpdated.ticketCounter,
      subject: input.subject,
      description: input.description,
      priority: input.priority || "MEDIUM",
      channel: "PORTAL",
      stageId: stage.id,
      typeId: type?.id,
      customerId: customer.id,
    },
    include: { type: true },
  });

  await applySlaToTicket({
    organizationId: org.id,
    ticketId: ticket.id,
    priority: ticket.priority,
    typeId: ticket.typeId,
  });

  await logActivity({
    organizationId: org.id,
    customerId: customer.id,
    ticketId: ticket.id,
    type: "TICKET",
    title: `Portal ticket #${ticket.number} created`,
  });

  await runAutomations({
    organizationId: org.id,
    trigger: "TICKET_CREATED",
    ticketId: ticket.id,
    context: {
      priority: ticket.priority,
      typeName: ticket.type?.name || "",
      channel: "PORTAL",
    },
  });

  const conversation = await db.conversation.create({
    data: {
      organizationId: org.id,
      channel: "PORTAL",
      customerId: customer.id,
      externalRef: input.email || input.phone || customer.id,
      subject: input.subject,
      status: "OPEN",
      unreadCount: 1,
      messages: {
        create: {
          direction: "IN",
          body: input.description,
          subject: input.subject,
        },
      },
    },
  });

  await db.ticket.update({
    where: { id: ticket.id },
    data: { conversationId: conversation.id },
  });

  return {
    ticketNumber: ticket.number,
    trackingCode: `${org.slug}-${ticket.number}`,
  };
}

export async function portalTrackTicket(orgSlug: string, ticketNumber: number, contact: string) {
  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new Error("Organization not found");

  const ticket = await db.ticket.findFirst({
    where: {
      organizationId: org.id,
      number: ticketNumber,
      customer: {
        OR: [
          { phone: contact },
          { email: { equals: contact, mode: "insensitive" } },
        ],
      },
    },
    include: {
      stage: true,
      type: true,
      customer: { select: { name: true } },
    },
  });

  if (!ticket) throw new Error("Ticket not found — check number and phone/email");

  return {
    number: ticket.number,
    subject: ticket.subject,
    stage: ticket.stage.name,
    stageKey: ticket.stage.key,
    priority: ticket.priority,
    type: ticket.type?.name || null,
    customerName: ticket.customer.name,
    createdAt: ticket.createdAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() || null,
  };
}
