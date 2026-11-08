"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function submitProductReview(input: {
  orgSlug: string;
  productId: string;
  authorName: string;
  rating: number;
  comment?: string;
}) {
  const org = await db.organization.findUnique({ where: { slug: input.orgSlug } });
  if (!org || org.status === "SUSPENDED") throw new Error("Shop unavailable");

  const product = await db.product.findFirst({
    where: { id: input.productId, organizationId: org.id, active: true },
  });
  if (!product) throw new Error("Product not found");

  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  await db.productReview.create({
    data: {
      organizationId: org.id,
      productId: product.id,
      authorName: input.authorName.trim() || "Customer",
      rating,
      comment: input.comment?.trim() || null,
    },
  });

  revalidatePath(`/shop/${org.slug}`);
  revalidatePath(`/shop/${org.slug}/${product.id}`);
}
