"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { OmniChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { ingestInboundMessage } from "@/lib/connectors";

function deriveExternalKey(
  channel: OmniChannel,
  config: Record<string, unknown>
): string | null {
  if (channel === "WHATSAPP") {
    const key = String(config.phoneNumberId || "").trim();
    return key || null;
  }
  if (channel === "EMAIL") {
    const key = String(config.fromEmail || "").trim().toLowerCase();
    return key || null;
  }
  return null;
}

export async function upsertChannelConnector(data: {
  id?: string;
  channel: OmniChannel;
  name: string;
  enabled: boolean;
  mode: "UI_ONLY" | "WEBHOOK";
  regenerateSecret?: boolean;
  assigneeId?: string | null;
  config?: Record<string, unknown>;
}) {
  const session = await requirePerm("settings:manage");
  const organizationId = session.organizationId;

  const existing = data.id
    ? await db.channelConnector.findFirst({
        where: { id: data.id, organizationId },
      })
    : null;

  if (data.id && !existing) throw new Error("Connector not found");

  const webhookSecret =
    data.mode === "WEBHOOK"
      ? data.regenerateSecret || !existing?.webhookSecret
        ? randomBytes(24).toString("hex")
        : existing!.webhookSecret
      : existing?.webhookSecret || null;

  const prevConfig =
    existing?.config && typeof existing.config === "object"
      ? (existing.config as Record<string, unknown>)
      : {};
  const nextConfig = { ...prevConfig, ...(data.config || {}) };
  const externalKey = deriveExternalKey(data.channel, nextConfig);

  let assigneeId =
    data.assigneeId === undefined
      ? existing?.assigneeId ?? null
      : data.assigneeId || null;

  if (assigneeId) {
    const agent = await db.user.findFirst({
      where: {
        id: assigneeId,
        organizationId,
        active: true,
        role: { in: ["AGENT", "MANAGER", "ORG_ADMIN"] },
      },
    });
    if (!agent) throw new Error("Assigned agent not found");
  }

  const connector = existing
    ? await db.channelConnector.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          enabled: data.enabled,
          mode: data.mode,
          webhookSecret,
          externalKey,
          assigneeId,
          config: nextConfig as Prisma.InputJsonValue,
        },
      })
    : await db.channelConnector.create({
        data: {
          organizationId,
          channel: data.channel,
          name: data.name,
          enabled: data.enabled,
          mode: data.mode,
          webhookSecret,
          externalKey,
          assigneeId,
          config: nextConfig as Prisma.InputJsonValue,
        },
      });

  revalidatePath("/settings/channels");
  revalidatePath("/inbox");
  return connector;
}

export async function createChannelConnector(data: {
  channel: OmniChannel;
  name?: string;
}) {
  const session = await requirePerm("settings:manage");
  const labels: Record<OmniChannel, string> = {
    WHATSAPP: "WhatsApp",
    EMAIL: "Email",
    CALL: "Call Intake",
    PORTAL: "Portal",
  };
  const count = await db.channelConnector.count({
    where: {
      organizationId: session.organizationId,
      channel: data.channel,
    },
  });
  const connector = await db.channelConnector.create({
    data: {
      organizationId: session.organizationId,
      channel: data.channel,
      name: data.name || `${labels[data.channel]} ${count + 1}`,
      enabled: true,
      mode: "UI_ONLY",
      config: { mock: true },
    },
  });
  revalidatePath("/settings/channels");
  return connector;
}

export async function deleteChannelConnector(id: string) {
  const session = await requirePerm("settings:manage");
  const existing = await db.channelConnector.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) throw new Error("Connector not found");

  await db.conversation.updateMany({
    where: { connectorId: id },
    data: { connectorId: null },
  });
  await db.channelConnector.delete({ where: { id } });
  revalidatePath("/settings/channels");
  revalidatePath("/inbox");
}

export async function ensureDefaultConnectors() {
  const session = await requirePerm("settings:manage");
  const channels: { channel: OmniChannel; name: string }[] = [
    { channel: "WHATSAPP", name: "WhatsApp" },
    { channel: "EMAIL", name: "Email" },
    { channel: "CALL", name: "Call Intake" },
    { channel: "PORTAL", name: "Portal" },
  ];

  for (const ch of channels) {
    const existing = await db.channelConnector.findFirst({
      where: {
        organizationId: session.organizationId,
        channel: ch.channel,
      },
    });
    if (!existing) {
      await db.channelConnector.create({
        data: {
          organizationId: session.organizationId,
          channel: ch.channel,
          name: ch.name,
          enabled: true,
          mode: "UI_ONLY",
          config: { mock: true },
        },
      });
    }
  }

  revalidatePath("/settings/channels");
}

export async function simulateInboundMessage(input: {
  connectorId?: string;
  channel: OmniChannel;
  externalRef: string;
  body: string;
  subject?: string;
  customerName?: string;
}) {
  const session = await requirePerm("tickets:write");

  let connectorId = input.connectorId;
  if (!connectorId) {
    const fallback = await db.channelConnector.findFirst({
      where: {
        organizationId: session.organizationId,
        channel: input.channel,
        enabled: true,
      },
      orderBy: { createdAt: "asc" },
    });
    connectorId = fallback?.id;
  }

  const result = await ingestInboundMessage(session.organizationId, {
    channel: input.channel,
    connectorId,
    externalRef: input.externalRef,
    body: input.body,
    subject: input.subject,
    customerName: input.customerName,
    customerPhone:
      input.channel === "WHATSAPP" || input.channel === "CALL"
        ? input.externalRef
        : undefined,
    customerEmail: input.channel === "EMAIL" ? input.externalRef : undefined,
  });
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  return result;
}
