import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { submitProductReview } from "@/server/actions/shop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orgSlug: string; productId: string }> };

async function reviewAction(formData: FormData) {
  "use server";
  await submitProductReview({
    orgSlug: String(formData.get("orgSlug")),
    productId: String(formData.get("productId")),
    authorName: String(formData.get("authorName") || ""),
    rating: Number(formData.get("rating") || 5),
    comment: String(formData.get("comment") || "") || undefined,
  });
}

export default async function ShopProductPage({ params }: Props) {
  const { orgSlug, productId } = await params;
  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org || org.status === "SUSPENDED") notFound();

  const product = await db.product.findFirst({
    where: { id: productId, organizationId: org.id, active: true },
    include: { reviews: { orderBy: { createdAt: "desc" } } },
  });
  if (!product) notFound();

  const avg =
    product.reviews.length > 0
      ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
      : null;

  return (
    <div className="min-h-screen bg-[#f4f7f6]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href={`/shop/${org.slug}`} className="text-sm text-teal-700 hover:underline">
            ← {org.name} shop
          </Link>
          <Link href={`/portal/${org.slug}`} className="text-sm text-slate-500 hover:underline">
            Need help?
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div>
          {product.category && <Badge color="teal">{product.category}</Badge>}
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">{product.name}</h1>
          <p className="mt-2 text-2xl font-semibold text-teal-700">
            {formatCurrency(Number(product.unitPrice))}
          </p>
          <p className="mt-3 text-slate-600">{product.description}</p>
          <p className="mt-2 text-sm text-slate-500">
            {avg ? `Average ★ ${avg.toFixed(1)} from ${product.reviews.length} reviews` : "No reviews yet"}
          </p>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Write a review</h2>
          <form action={reviewAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="orgSlug" value={org.slug} />
            <input type="hidden" name="productId" value={product.id} />
            <div>
              <Label>Your name</Label>
              <Input name="authorName" required />
            </div>
            <div>
              <Label>Rating</Label>
              <Select name="rating" defaultValue="5">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Comment</Label>
              <Textarea name="comment" rows={3} />
            </div>
            <Button type="submit">Submit review</Button>
          </form>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900">Customer reviews</h2>
          {product.reviews.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-100 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.authorName}</span>
                <span className="text-sm text-amber-600">★ {r.rating}</span>
              </div>
              {r.comment && <p className="mt-1 text-sm text-slate-600">{r.comment}</p>}
              <p className="mt-1 text-xs text-slate-400">{formatDate(r.createdAt)}</p>
            </div>
          ))}
          {product.reviews.length === 0 && (
            <p className="text-sm text-slate-400">Be the first to review.</p>
          )}
        </section>
      </main>
    </div>
  );
}
