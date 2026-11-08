"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { CallOutcome, OmniChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automation";
import { createCustomer } from "@/server/actions/customers";
import { createTicket } from "@/server/actions/tickets";
import { formatCurrency } from "@/lib/utils";

async function loadConversationForSend(conversationId: string, organizationId: string) {
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

  return { conversation, connector, config };
}

/** Inbox text reply — central path also syncs open linked tickets. */
export async function sendMessage(conversationId: string, body: string) {
  const { sendCustomerReply } = await import("@/server/actions/replies");
  const result = await sendCustomerReply({
    conversationId,
    body,
    isInternal: false,
  });
  if (!result.messageId) {
    throw new Error("Failed to send message");
  }
  return db.message.findUniqueOrThrow({ where: { id: result.messageId } });
}

/** Send image or voice note on WhatsApp (mock stores locally; live uploads to Meta). */
export async function sendWhatsAppMediaMessage(
  conversationId: string,
  formData: FormData
) {
  const session = await requirePerm("tickets:write");
  const { conversation, config } = await loadConversationForSend(
    conversationId,
    session.organizationId
  );
  if (conversation.channel !== "WHATSAPP") {
    throw new Error("Media send is only for WhatsApp");
  }

  const file = formData.get("file") as File | null;
  const kindRaw = String(formData.get("kind") || "image");
  const caption = String(formData.get("caption") || "").trim();
  const durationMs = Number(formData.get("durationMs") || 0) || undefined;

  if (!file || !file.size) throw new Error("File required");
  if (file.size > 16 * 1024 * 1024) throw new Error("Max 16MB");

  const kind = kindRaw === "audio" ? "audio" : "image";
  const mimeType =
    file.type || (kind === "audio" ? "audio/webm" : "image/jpeg");
  if (kind === "image" && !mimeType.startsWith("image/")) {
    throw new Error("Image file required");
  }
  if (kind === "audio" && !mimeType.startsWith("audio/")) {
    throw new Error("Audio file required");
  }

  const uploadRoot = process.env.UPLOAD_DIR || "./uploads";
  const dir = path.join(
    uploadRoot,
    session.organizationId,
    "inbox",
    conversationId
  );
  await mkdir(dir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || `${kind}.bin`;
  const stored = `${Date.now()}-${safeName}`;
  const fullPath = path.join(dir, stored);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  const to =
    conversation.externalRef || conversation.customer?.phone || "";
  const { sendWhatsAppMedia } = await import("@/lib/integrations/whatsapp");
  const result = await sendWhatsAppMedia(
    {
      accessToken: String(config.accessToken || ""),
      phoneNumberId: String(config.phoneNumberId || ""),
      mock: config.mock !== false,
    },
    to,
    {
      kind,
      buffer,
      mimeType,
      fileName: safeName,
      caption: caption || undefined,
    }
  );
  if (!result.ok && result.mode === "LIVE") {
    throw new Error(result.error || "WhatsApp media send failed");
  }

  const body =
    kind === "audio"
      ? caption || "🎤 Voice message"
      : caption || "📷 Photo";

  const message = await db.message.create({
    data: {
      conversationId,
      direction: "OUT",
      body,
      authorUserId: session.user.id,
      meta: {
        kind,
        mimeType,
        fileName: file.name,
        filePath: fullPath,
        durationMs,
        delivery: {
          mode: result.mode,
          ok: result.ok,
          provider: result.provider,
          externalId: result.externalId,
          error: result.error,
        },
      } as Prisma.InputJsonValue,
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), unreadCount: 0, status: "PENDING" },
  });

  const { syncMessageToLinkedTickets } = await import("@/server/actions/replies");
  await syncMessageToLinkedTickets({
    organizationId: session.organizationId,
    conversationId,
    body,
    authorId: session.user.id,
    title: kind === "audio" ? "Voice reply (inbox sync)" : "Photo reply (inbox sync)",
  });

  revalidatePath("/inbox");
  return { id: message.id, kind };
}

/** Send a CRM product card into the WhatsApp thread (catalog item). */
export async function sendWhatsAppProduct(
  conversationId: string,
  productId: string
) {
  const session = await requirePerm("tickets:write");
  const { conversation, config } = await loadConversationForSend(
    conversationId,
    session.organizationId
  );
  if (conversation.channel !== "WHATSAPP") {
    throw new Error("Product send is only for WhatsApp");
  }

  const product = await db.product.findFirst({
    where: {
      id: productId,
      organizationId: session.organizationId,
      active: true,
    },
  });
  if (!product) throw new Error("Product not found");

  const org = await db.organization.findUniqueOrThrow({
    where: { id: session.organizationId },
    select: { slug: true },
  });
  const shopUrl = `/shop/${org.slug}`;
  const price = formatCurrency(Number(product.unitPrice));
  const body = [
    `📦 *${product.name}*`,
    product.sku ? `SKU: ${product.sku}` : null,
    `Price: ${price}`,
    product.description ? product.description.slice(0, 280) : null,
    product.whatsappProductId
      ? `(Catalog ID: ${product.whatsappProductId})`
      : "Synced catalog item",
    `View: ${shopUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const to =
    conversation.externalRef || conversation.customer?.phone || "";
  const { sendWhatsAppMessage } = await import("@/lib/integrations/whatsapp");
  const result = await sendWhatsAppMessage(
    {
      accessToken: String(config.accessToken || ""),
      phoneNumberId: String(config.phoneNumberId || ""),
      mock: config.mock !== false,
    },
    to,
    body
  );
  if (!result.ok && result.mode === "LIVE") {
    throw new Error(result.error || "WhatsApp product send failed");
  }

  const message = await db.message.create({
    data: {
      conversationId,
      direction: "OUT",
      body,
      authorUserId: session.user.id,
      meta: {
        kind: "product",
        productId: product.id,
        productName: product.name,
        productPrice: Number(product.unitPrice),
        productImageUrl: product.imageUrl,
        whatsappProductId: product.whatsappProductId,
        delivery: {
          mode: result.mode,
          ok: result.ok,
          provider: result.provider,
          externalId: result.externalId,
          error: result.error,
        },
      } as Prisma.InputJsonValue,
    },
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), unreadCount: 0, status: "PENDING" },
  });

  const { syncMessageToLinkedTickets } = await import("@/server/actions/replies");
  await syncMessageToLinkedTickets({
    organizationId: session.organizationId,
    conversationId,
    body,
    authorId: session.user.id,
    title: "Product reply (inbox sync)",
  });

  revalidatePath("/inbox");
  return message;
}

export async function markConversationRead(conversationId: string) {
  const session = await requirePerm("tickets:read");
  await db.conversation.updateMany({
    where: { id: conversationId, organizationId: session.organizationId },
    data: { unreadCount: 0 },
  });
  // Avoid revalidatePath("/inbox") here — it remounts the whole inbox on every click.
}

/** Open or create CRM customer from an inbox conversation, then link the thread. */
export async function ensureCustomerFromConversation(conversationId: string) {
  const session = await requirePerm("customers:write");
  const organizationId = session.organizationId;

  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, organizationId },
    include: { customer: true },
  });
  if (!conversation) throw new Error("Conversation not found");

  if (conversation.customerId) {
    const linked =
      conversation.customer ||
      (await db.customer.findFirst({
        where: { id: conversation.customerId, organizationId },
      }));
    if (linked) {
      return {
        id: linked.id,
        name: linked.name,
        phone: linked.phone,
        email: linked.email,
        created: false as const,
      };
    }
  }

  const phoneCandidate =
    conversation.channel === "EMAIL"
      ? null
      : conversation.externalRef || conversation.customer?.phone || null;
  const emailCandidate =
    conversation.channel === "EMAIL"
      ? conversation.externalRef || conversation.customer?.email || null
      : conversation.customer?.email || null;

  let existing =
    (phoneCandidate &&
      (await db.customer.findFirst({
        where: { organizationId, phone: phoneCandidate },
      }))) ||
    (emailCandidate &&
      (await db.customer.findFirst({
        where: { organizationId, email: emailCandidate },
      }))) ||
    null;

  let created = false;
  if (!existing) {
    const name =
      conversation.customer?.name ||
      conversation.subject ||
      phoneCandidate ||
      emailCandidate ||
      `${conversation.channel} contact`;

    existing = await createCustomer({
      name,
      phone: phoneCandidate || undefined,
      email: emailCandidate || undefined,
      source: conversation.channel,
      status: "LEAD",
    });
    created = true;
  }

  await db.conversation.update({
    where: { id: conversationId },
    data: { customerId: existing.id },
  });

  revalidatePath("/inbox");
  revalidatePath(`/customers/${existing.id}`);
  revalidatePath("/customers");

  return {
    id: existing.id,
    name: existing.name,
    phone: existing.phone,
    email: existing.email,
    created: created as boolean,
  };
}

export async function logIncomingCall(input: {
  phone: string;
  callerName?: string;
  reason?: string;
  notes?: string;
  customerId?: string;
  createComplaint?: boolean;
  subject?: string;
  description?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  departmentId?: string;
  typeId?: string;
}) {
  const session = await requirePerm("tickets:write");
  const organizationId = session.organizationId;

  let customerId = input.customerId;
  if (!customerId && input.callerName) {
    const existing = await db.customer.findFirst({
      where: { organizationId, phone: input.phone },
    });
    if (existing) customerId = existing.id;
    else {
      const c = await createCustomer({
        name: input.callerName,
        phone: input.phone,
        source: "Call",
        status: "LEAD",
      });
      customerId = c.id;
    }
  }

  const conversation = await db.conversation.create({
    data: {
      organizationId,
      channel: "CALL",
      customerId: customerId || null,
      externalRef: input.phone,
      subject: input.reason || "Incoming call",
      assigneeId: session.user.id,
      lastMessageAt: new Date(),
      messages: {
        create: {
          direction: "IN",
          body: input.notes || input.reason || "Incoming call logged",
        },
      },
    },
  });

  let outcome: CallOutcome = "LOGGED";
  let ticketId: string | undefined;

  if (input.createComplaint) {
    const ticket = await createTicket({
      customerId,
      newCustomer: !customerId
        ? { name: input.callerName || input.phone, phone: input.phone }
        : undefined,
      subject: input.subject || input.reason || `Call from ${input.phone}`,
      description:
        input.description ||
        input.notes ||
        `Call intake from ${input.phone}`,
      priority: input.priority || "MEDIUM",
      channel: "PHONE",
      typeId: input.typeId,
      departmentId: input.departmentId,
      conversationId: conversation.id,
    });
    ticketId = ticket.id;
    outcome = "COMPLAINT_CREATED";
  }

  const callLog = await db.callLog.create({
    data: {
      organizationId,
      conversationId: conversation.id,
      customerId: customerId || null,
      agentId: session.user.id,
      phone: input.phone,
      callerName: input.callerName,
      reason: input.reason,
      notes: input.notes,
      outcome,
    },
  });

  await logActivity({
    organizationId,
    userId: session.user.id,
    customerId,
    ticketId,
    type: "CALL",
    title: `Call logged: ${input.phone}`,
    body: input.reason,
  });

  await runAutomations({
    organizationId,
    trigger: "CALL_LOGGED",
    ticketId,
    context: {
      phone: input.phone,
      outcome,
    },
  });

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  return { callLog, conversationId: conversation.id, ticketId };
}

export async function ingestDemoInbound(
  conversationId: string,
  body: string,
  subject?: string
) {
  const session = await requirePerm("tickets:write");
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, organizationId: session.organizationId },
  });
  if (!conversation) throw new Error("Not found");

  await db.message.create({
    data: {
      conversationId,
      direction: "IN",
      body,
      subject,
    },
  });
  await db.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      unreadCount: { increment: 1 },
      status: "OPEN",
    },
  });

  await runAutomations({
    organizationId: session.organizationId,
    trigger: "MESSAGE_RECEIVED",
    context: {
      channel: conversation.channel,
      conversationId,
    },
  });

  revalidatePath("/inbox");
}

export async function ensureChannelConversations() {
  // no-op helper for types
  return null as OmniChannel | null;
}
