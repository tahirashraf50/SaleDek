"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";

export async function createKnowledgeArticle(data: {
  title: string;
  category?: string;
  body: string;
}) {
  const session = await requirePerm("settings:manage");
  const article = await db.knowledgeArticle.create({
    data: {
      organizationId: session.organizationId,
      title: data.title,
      category: data.category || null,
      body: data.body,
    },
  });
  revalidatePath("/settings/knowledge");
  return article;
}

export async function updateKnowledgeArticle(
  id: string,
  data: Partial<{ title: string; category: string; body: string; active: boolean }>
) {
  const session = await requirePerm("settings:manage");
  await db.knowledgeArticle.updateMany({
    where: { id, organizationId: session.organizationId },
    data,
  });
  revalidatePath("/settings/knowledge");
}

export async function searchKnowledge(query: string) {
  const session = await requirePerm("tickets:read");
  if (!query.trim()) {
    return db.knowledgeArticle.findMany({
      where: { organizationId: session.organizationId, active: true },
      take: 10,
      orderBy: { updatedAt: "desc" },
    });
  }
  return db.knowledgeArticle.findMany({
    where: {
      organizationId: session.organizationId,
      active: true,
      OR: [
        { title: { contains: query } },
        { body: { contains: query } },
        { category: { contains: query } },
      ],
    },
    take: 10,
  });
}
