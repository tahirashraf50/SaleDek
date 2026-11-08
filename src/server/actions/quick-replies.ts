"use server";

import { revalidatePath } from "next/cache";
import { OmniChannel } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";

export async function createQuickReply(data: {
  title: string;
  body: string;
  shortcut?: string;
  channel?: OmniChannel | null;
}) {
  const session = await requirePerm("settings:manage");
  const title = data.title.trim();
  const body = data.body.trim();
  if (!title || !body) throw new Error("Title and body required");

  const shortcut = data.shortcut?.trim().replace(/^\/*/, "") || null;
  const reply = await db.quickReply.create({
    data: {
      organizationId: session.organizationId,
      title,
      body,
      shortcut: shortcut ? `/${shortcut}` : null,
      channel: data.channel || null,
    },
  });
  revalidatePath("/settings/quick-replies");
  revalidatePath("/inbox");
  return reply;
}

export async function updateQuickReply(
  id: string,
  data: Partial<{
    title: string;
    body: string;
    shortcut: string | null;
    channel: OmniChannel | null;
    active: boolean;
    sortOrder: number;
  }>
) {
  const session = await requirePerm("settings:manage");
  const existing = await db.quickReply.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!existing) throw new Error("Not found");

  const shortcut =
    data.shortcut === undefined
      ? undefined
      : data.shortcut?.trim()
        ? `/${data.shortcut.trim().replace(/^\/*/, "")}`
        : null;

  const reply = await db.quickReply.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.body !== undefined ? { body: data.body.trim() } : {}),
      ...(shortcut !== undefined ? { shortcut } : {}),
      ...(data.channel !== undefined ? { channel: data.channel } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  });
  revalidatePath("/settings/quick-replies");
  revalidatePath("/inbox");
  return reply;
}

export async function deleteQuickReply(id: string) {
  const session = await requirePerm("settings:manage");
  await db.quickReply.deleteMany({
    where: { id, organizationId: session.organizationId },
  });
  revalidatePath("/settings/quick-replies");
  revalidatePath("/inbox");
}

export async function seedDefaultQuickReplies() {
  const session = await requirePerm("settings:manage");
  const count = await db.quickReply.count({
    where: { organizationId: session.organizationId },
  });
  if (count > 0) return { created: 0 };

  const defaults = [
    {
      title: "Greeting",
      shortcut: "/hi",
      body: "Assalam o Alaikum! PulseCRM support se baat kar rahe hain. Aapki madad kaise kar sakte hain?",
      channel: "WHATSAPP" as OmniChannel,
    },
    {
      title: "Please wait",
      shortcut: "/wait",
      body: "Shukriya — main details check kar raha/rahi hoon. 1–2 minute dijiye.",
      channel: "WHATSAPP" as OmniChannel,
    },
    {
      title: "Need more info",
      shortcut: "/info",
      body: "Baraye meherbani apna account / order number aur issue ki short detail bhej dein.",
      channel: null,
    },
    {
      title: "Resolved",
      shortcut: "/done",
      body: "Issue resolve ho gaya hai. Agar kuch aur madad chahiye to message karein. Shukriya!",
      channel: "WHATSAPP" as OmniChannel,
    },
    {
      title: "Business hours",
      shortcut: "/hours",
      body: "Hamari support timing: Mon–Sat, 9:00 AM – 6:00 PM. Is window ke bahar reply delay ho sakta hai.",
      channel: null,
    },
  ];

  await db.quickReply.createMany({
    data: defaults.map((d, i) => ({
      organizationId: session.organizationId,
      title: d.title,
      body: d.body,
      shortcut: d.shortcut,
      channel: d.channel,
      sortOrder: i,
    })),
  });
  revalidatePath("/settings/quick-replies");
  revalidatePath("/inbox");
  return { created: defaults.length };
}
