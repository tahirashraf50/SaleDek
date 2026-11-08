import { OmniChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runAutomations } from "@/lib/automation";

export type InboundMessagePayload = {
  channel: OmniChannel;
  connectorId?: string | null;
  externalRef: string;
  body: string;
  subject?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  meta?: Prisma.InputJsonValue;
};

/** Shared ingest used by Inbox UI demos and webhook connectors. */
export async function ingestInboundMessage(
  organizationId: string,
  payload: InboundMessagePayload
) {
  const connector = payload.connectorId
    ? await db.channelConnector.findFirst({
        where: {
          id: payload.connectorId,
          organizationId,
          channel: payload.channel,
        },
      })
    : await db.channelConnector.findFirst({
        where: { organizationId, channel: payload.channel, enabled: true },
        orderBy: { createdAt: "asc" },
      });

  let customer = await db.customer.findFirst({
    where: {
      organizationId,
      OR: [
        payload.customerPhone ? { phone: payload.customerPhone } : undefined,
        payload.customerEmail
          ? { email: { equals: payload.customerEmail } }
          : undefined,
        { phone: payload.externalRef },
        { email: { equals: payload.externalRef } },
      ].filter(Boolean) as object[],
    },
  });

  if (!customer && (payload.customerName || payload.customerPhone || payload.customerEmail)) {
    customer = await db.customer.create({
      data: {
        organizationId,
        name: payload.customerName || payload.externalRef,
        phone:
          payload.customerPhone ||
          (payload.channel === "WHATSAPP" || payload.channel === "CALL"
            ? payload.externalRef
            : null),
        email:
          payload.customerEmail ||
          (payload.channel === "EMAIL" ? payload.externalRef : null),
        source: payload.channel,
        status: "LEAD",
      },
    });
  }

  const connectorId = connector?.id ?? null;
  const assigneeId = connector?.assigneeId ?? null;

  let conversation = await db.conversation.findFirst({
    where: {
      organizationId,
      channel: payload.channel,
      externalRef: payload.externalRef,
      status: { not: "CLOSED" },
      ...(connectorId
        ? { OR: [{ connectorId }, { connectorId: null }] }
        : {}),
    },
    orderBy: { lastMessageAt: "desc" },
  });

  if (!conversation) {
    conversation = await db.conversation.create({
      data: {
        organizationId,
        channel: payload.channel,
        connectorId,
        assigneeId,
        externalRef: payload.externalRef,
        customerId: customer?.id,
        subject: payload.subject,
        status: "OPEN",
        unreadCount: 1,
        lastMessageAt: new Date(),
      },
    });
  } else {
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        unreadCount: { increment: 1 },
        lastMessageAt: new Date(),
        status: "OPEN",
        customerId: conversation.customerId || customer?.id,
        subject: payload.subject || conversation.subject,
        connectorId: conversation.connectorId || connectorId,
        assigneeId: conversation.assigneeId || assigneeId,
      },
    });
  }

  const message = await db.message.create({
    data: {
      conversationId: conversation.id,
      direction: "IN",
      body: payload.body,
      subject: payload.subject,
      meta: payload.meta,
    },
  });

  // Sync inbound customer message onto open linked tickets (central timeline)
  const noteBody = payload.subject
    ? `${payload.subject}\n\n${payload.body}`
    : payload.body;
  try {
    const { syncMessageToLinkedTickets } = await import(
      "@/server/actions/replies"
    );
    await syncMessageToLinkedTickets({
      organizationId,
      conversationId: conversation.id,
      body: noteBody,
      authorId: null,
      title: "Customer message (inbox sync)",
    });
  } catch {
    // non-fatal — ingest should still succeed
  }

  await runAutomations({
    organizationId,
    trigger: "MESSAGE_RECEIVED",
    context: {
      channel: payload.channel,
      conversationId: conversation.id,
      externalRef: payload.externalRef,
      connectorId: connectorId || undefined,
    },
  });

  return {
    conversationId: conversation.id,
    messageId: message.id,
    customerId: customer?.id,
    connectorId,
  };
}
