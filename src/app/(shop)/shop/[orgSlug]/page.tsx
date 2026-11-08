import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orgSlug: string }> };

export default async function ShopPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org || org.status === "SUSPENDED") notFound();

  const products = await db.product.findMany({
    where: { organizationId: org.id, active: true },
    include: { reviews: { select: { rating: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-[#f4f7f6]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">{org.name}</div>
            <div className="text-xs text-slate-500">Packages & products</div>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href={`/portal/${org.slug}`} className="text-teal-700 hover:underline">
              Support portal
            </Link>
            <Link href="/site" className="text-slate-500 hover:underline">
              PulseCRM
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Review our packages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Browse products, read ratings, and leave your review.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {products.map((p) => {
            const avg =
              p.reviews.length > 0
                ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length
                : null;
            return (
              <Link
                key={p.id}
                href={`/shop/${org.slug}/${p.id}`}
                className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-teal-300 hover:shadow-sm"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-teal-800">
                  {p.category || "Product"}
                </div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">{p.name}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                  {p.description || "No description"}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-semibold text-teal-700">
                    {formatCurrency(Number(p.unitPrice))}
                  </span>
                  <span className="text-xs text-slate-500">
                    {avg ? `★ ${avg.toFixed(1)} (${p.reviews.length})` : "No reviews yet"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        {products.length === 0 && (
          <p className="mt-8 text-center text-sm text-slate-400">No products published yet.</p>
        )}
      </main>
    </div>
  );
}
