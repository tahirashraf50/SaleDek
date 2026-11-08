"use server";

import { revalidatePath } from "next/cache";
import { Prisma, TicketStageKey } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { logActivity } from "@/lib/activity";

const CLOSED_OR_DONE: TicketStageKey[] = ["CLOSED", "RESOLVED"];

type Delivery = {
  mode?: string;
  ok?: boolean;
  provider?: string;
  externalId?: string;
  error?: string;
};

async function loadConversation(conversationId: string, organizationId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, organizationId },
    include: { customer: true, connector: true },
  });
  if (!conversation) throw new Error("Conversation not found");

  const connector =
    conversation.connector ||
    (await db.channelConnector.findFirst({
      where: {
        organizationId,
        channel: conversation.channel,
        enabled: true,
      },
      orderBy: { createdAt: "asc" },
    }));
  const config =
    connector?.config && typeof connector.config === "object"
      ? (connector.config as Record<string, unknown>)
      : {};

  return { conversation, config };
}

async function deliverOutbound(
  conversationId: string,
  organizationId: string,
  body: string,
  authorUserId: string
) {
  const { conversation, config } = await loadConversation(
    conversationId,
    organizationId
  );

  let delivery: Delivery = { mode: "STORE_ONLY" };

  if (conversation.channel === "WHATSAPP") {
    const { sendWhatsAppMessage } = await import("@/lib/integrations/whatsapp");
    const to =
      conversation.externalRef || conversation.customer?.phone || "";
    const result = await sendWhatsAppMessage(
      {
        accessToken: String(config.accessToken || ""),
        phoneNumberId: String(config.phoneNumberId || ""),
        mock: config.mock !== false,
      },
      to,
      body
    );
    delivery = {
      mode: result.mode,
      ok: result.ok,
      provider: result.provider,
      externalId: result.externalId,
      error: result.error,
    };
    if (!result.ok && result.mode === "LIVE") {
      throw new Error(result.error || "WhatsApp send failed");
    }
  }

  if (conversation.channel === "EMAIL") {
    const { sendEmailMessage } = await import("@/lib/integrations/email");
    const to =
      conversation.externalRef || conversation.customer?.email || "";
    const result = await sendEmailMessage(
      {
        smtpHost: String(config.smtpHost || ""),
        smtpPort: Number(config.smtpPort || 587),
        smtpUser: String(config.smtpUser || ""),
        smtpPass: String(config.smtpPass || ""),
        fromEmail: String(config.fromEmail || ""),
        mock: config.mock !== false,
      },
      to,
      conversation.subject || "Support reply",
      body
    );
    delivery = {
      mode: result.mode,
      ok: result.ok,
      provider: result.provider,
      externalId: result.externalId,
      error: result.error,
    };
    if (!result.ok && result.mode === "LIVE") {
      throw new Error(result.error || "Email send failed");
    }
  }

  const message = await db.message.create({
    data: {
      conversationId,
      direction: "OUT",
      body,
      authorUserId,
      subject: conversation.channel === "EMAIL" ? conversation.subject : null,
      meta: { kind: "text", delivery, synced: true } as Prisma.InputJsonValue,
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), unreadCount: 0, status: "PENDING" },
  });

  return { message, conversation, delivery };
}

/** Write customer-visible notes on open tickets linked to a conversation. */
export async function syncMessageToLinkedTickets(input: {
  organizationId: string;
  conversationId: string;
  body: string;
  authorId?: string | null;
  title: string;
  /** Skip creating a duplicate note on this ticket (already written). */
  skipTicketId?: string;
}) {
  const tickets = await db.ticket.findMany({
    where: {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      ...(input.skipTicketId ? { id: { not: input.skipTicketId } } : {}),
      stage: { key: { notIn: CLOSED_OR_DONE } },
    },
    select: { id: true, customerId: true, firstRespondedAt: true },
  });

  for (const ticket of tickets) {
    if (!ticket.firstRespondedAt && input.authorId) {
      await db.ticket.update({
        where: { id: ticket.id },
        data: { firstRespondedAt: new Date() },
      });
      await db.slaTimer.updateMany({
        where: { ticketId: ticket.id, firstMetAt: null },
        data: { firstMetAt: new Date() },
      });
    }

    await db.ticketNote.create({
      data: {
        ticketId: ticket.id,
        authorId: input.authorId || null,
        body: input.body,
        isInternal: false,
      },
    });

    await logActivity({
      organizationId: input.organizationId,
      userId: input.authorId || undefined,
      customerId: ticket.customerId,
      ticketId: ticket.id,
      type: "NOTE",
      title: input.title,
      body: input.body,
    });

    revalidatePath(`/tickets/${ticket.id}`);
  }

  if (tickets.length) revalidatePath("/tickets");
  return tickets.length;
}

/**
 * Central customer reply path (standard omnichannel pattern).
 * Ticket page OR Inbox → same function → channel send + ticket timeline sync.
 */
export async function sendCustomerReply(input: {
  body: string;
  conversationId?: string | null;
  ticketId?: string | null;
  /** true = ticket-only internal note, no channel send */
  isInternal?: boolean;
}) {
  const session = await requirePerm("tickets:write");
  const organizationId = session.organizationId;
  const body = input.body.trim();
  if (!body) throw new Error("Message required");

  // Internal note — ticket only
  if (input.isInternal) {
    if (!input.ticketId) throw new Error("Ticket required for internal note");
    const ticket = await db.ticket.findFirst({
      where: { id: input.ticketId, organizationId },
    });
    if (!ticket) throw new Error("Ticket not found");

    const note = await db.ticketNote.create({
      data: {
        ticketId: ticket.id,
        authorId: session.user.id,
        body,
        isInternal: true,
      },
    });
    await logActivity({
      organizationId,
      userId: session.user.id,
      customerId: ticket.customerId,
      ticketId: ticket.id,
      type: "NOTE",
      title: "Internal note",
      body,
    });
    revalidatePath(`/tickets/${ticket.id}`);
    revalidatePath("/tickets");
    return { noteId: note.id, messageId: null as string | null, channelSent: false };
  }

  // Resolve conversation + optional ticket
  let ticketId = input.ticketId || null;
  let conversationId = input.conversationId || null;
  let ticket =
    ticketId
      ? await db.ticket.findFirst({
          where: { id: ticketId, organizationId },
          include: { stage: { select: { key: true } } },
        })
      : null;

  if (ticketId && !ticket) throw new Error("Ticket not found");

  if (!conversationId && ticket?.conversationId) {
    conversationId = ticket.conversationId;
  }

  if (!conversationId) {
    // Customer-visible note without channel (no linked inbox thread)
    if (!ticket) {
      throw new Error("Conversation or ticket required");
    }
    if (!ticket.firstRespondedAt) {
      await db.ticket.update({
        where: { id: ticket.id },
        data: { firstRespondedAt: new Date() },
      });
      await db.slaTimer.updateMany({
        where: { ticketId: ticket.id, firstMetAt: null },
        data: { firstMetAt: new Date() },
      });
    }
    const note = await db.ticketNote.create({
      data: {
        ticketId: ticket.id,
        authorId: session.user.id,
        body,
        isInternal: false,
      },
    });
    await logActivity({
      organizationId,
      userId: session.user.id,
      customerId: ticket.customerId,
      ticketId: ticket.id,
      type: "NOTE",
      title: "Customer reply (no inbox link)",
      body,
    });
    revalidatePath(`/tickets/${ticket.id}`);
    return { noteId: note.id, messageId: null as string | null, channelSent: false };
  }

  const { message } = await deliverOutbound(
    conversationId,
    organizationId,
    body,
    session.user.id
  );

  // Primary ticket note (if started from ticket)
  let noteId: string | null = null;
  if (ticket) {
    if (!ticket.firstRespondedAt) {
      await db.ticket.update({
        where: { id: ticket.id },
        data: { firstRespondedAt: new Date() },
      });
      await db.slaTimer.updateMany({
        where: { ticketId: ticket.id, firstMetAt: null },
        data: { firstMetAt: new Date() },
      });
    }
    const note = await db.ticketNote.create({
      data: {
        ticketId: ticket.id,
        authorId: session.user.id,
        body,
        isInternal: false,
      },
    });
    noteId = note.id;
    await logActivity({
      organizationId,
      userId: session.user.id,
      customerId: ticket.customerId,
      ticketId: ticket.id,
      type: "NOTE",
      title: "Customer reply",
      body,
    });
    revalidatePath(`/tickets/${ticket.id}`);
  }

  // Sync to other open tickets on the same conversation
  await syncMessageToLinkedTickets({
    organizationId,
    conversationId,
    body,
    authorId: session.user.id,
    title: "Customer reply (inbox sync)",
    skipTicketId: ticket?.id,
  });

  revalidatePath("/inbox");
  revalidatePath("/tickets");
  revalidatePath("/dashboard");

  return {
    noteId,
    messageId: message.id,
    channelSent: true,
    conversationId,
  };
}
