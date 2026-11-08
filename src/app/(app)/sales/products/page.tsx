import Link from "next/link";
import {
  ListChecks,
  MessageCircle,
  Package,
  Percent,
  Search,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { syncWhatsAppCatalog } from "@/server/actions/sales";
import { parseProductFormConfig } from "@/lib/product-form";
import { ProductEditor } from "@/components/sales/product-editor";
import { ProductRowActions } from "@/components/sales/product-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

const SWATCH = ["#ef1e1e", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ac16e0"];

async function syncCatalogAction() {
  "use server";
  await syncWhatsAppCatalog();
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function ProductsPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;

  const products = await db.product.findMany({
    where: {
      organizationId: session.organizationId,
      ...(statusFilter === "active" ? { active: true } : {}),
      ...(statusFilter === "inactive" ? { active: false } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { sku: { contains: query, mode: "insensitive" as const } },
              { category: { contains: query, mode: "insensitive" as const } },
              { description: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const [totalAll, activeCount, inactiveCount, waSynced] = await Promise.all([
    db.product.count({ where: { organizationId: session.organizationId } }),
    db.product.count({
      where: { organizationId: session.organizationId, active: true },
    }),
    db.product.count({
      where: { organizationId: session.organizationId, active: false },
    }),
    db.product.count({
      where: {
        organizationId: session.organizationId,
        whatsappProductId: { not: null },
      },
    }),
  ]);

  const withForms = products.filter(
    (p) => parseProductFormConfig(p.formFields).fields.length > 0
  ).length;

  function href(next: { q?: string; status?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const status = next.status !== undefined ? next.status : params.status;
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    const s = qs.toString();
    return s ? `/sales/products?${s}` : "/sales/products";
  }

  const statusChips = [
    { id: "", label: "All", count: totalAll },
    { id: "active", label: "Active", count: activeCount },
    { id: "inactive", label: "Inactive", count: inactiveCount },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Products
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Packages, pricing rules & sale forms · {products.length}
            {query || statusFilter ? " matching" : " shown"}
            {totalAll !== products.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/sales/products" method="get" className="flex gap-2">
            {statusFilter ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                name="q"
                placeholder="Search name, SKU, category…"
                defaultValue={query || ""}
                className="h-10 w-64 border-slate-200 bg-white pl-9 shadow-sm sm:w-72"
              />
            </div>
            <Button type="submit" variant="outline" className="h-10 bg-white">
              Search
            </Button>
          </form>
          <form action={syncCatalogAction}>
            <Button
              type="submit"
              variant="outline"
              className="h-10 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4" />
              Sync WhatsApp
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Catalog</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} live · {inactiveCount} off
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ef1e1e] text-white shadow-md shadow-red-500/20">
              <Package className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Sellable on New Sale</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Custom forms</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{withForms}</p>
          <p className="mt-1 text-[11px] text-slate-400">In current list</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">WhatsApp synced</p>
          <p className="mt-1 text-2xl font-bold text-[#8b10b8]">{waSynced}</p>
          <p className="mt-1 text-[11px] text-slate-400">Catalog product IDs</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusChips.map((f) => {
          const active = (statusFilter || "") === f.id;
          return (
            <Link
              key={f.id || "all"}
              href={href({ status: active && f.id ? "" : f.id })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                active
                  ? "bg-[#ef1e1e] text-white shadow-sm shadow-red-500/25"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {f.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-[#ef1e1e]" />
              <h2 className="text-base font-semibold text-slate-900">Catalog</h2>
            </div>
            <p className="text-xs text-slate-400">Edit pricing & form fields</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Pricing</th>
                  <th className="px-3 py-3 font-semibold">Sale form</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const config = parseProductFormConfig(p.formFields);
                  const fields = config.fields;
                  const rule = config.priceRule;
                  const ruleField = rule
                    ? fields.find((f) => f.id === rule.fieldId)
                    : null;
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        "border-b border-slate-50 transition hover:bg-slate-50/90",
                        !p.active && "opacity-75"
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={p.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
                              style={{
                                backgroundColor: SWATCH[i % SWATCH.length],
                              }}
                            >
                              {initials(p.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {p.name}
                            </p>
                            <p className="truncate text-[11px] text-slate-400">
                              {p.sku || "No SKU"}
                              {p.category ? ` · ${p.category}` : ""}
                            </p>
                            {p.whatsappProductId ? (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-[#8b10b8]">
                                <MessageCircle className="h-3 w-3" />
                                Synced
                                {p.catalogSyncedAt
                                  ? ` · ${formatDateTime(p.catalogSyncedAt)}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        {rule ? (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-[#ef1e1e] ring-1 ring-rose-100">
                              <Percent className="h-3 w-3" />
                              {rule.percent}% of {ruleField?.label || "field"}
                            </span>
                            <p className="mt-1 text-[10px] text-slate-400">
                              fallback {formatCurrency(Number(p.unitPrice))}
                            </p>
                          </div>
                        ) : (
                          <p className="font-semibold text-slate-900">
                            {formatCurrency(Number(p.unitPrice))}
                          </p>
                        )}
                        {Number(p.taxPercent) > 0 ? (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            +{Number(p.taxPercent)}% tax
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3.5">
                        {fields.length ? (
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {fields.slice(0, 3).map((f) => (
                              <span
                                key={f.id}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100"
                              >
                                <ListChecks className="h-2.5 w-2.5 text-slate-400" />
                                {f.label}
                              </span>
                            ))}
                            {fields.length > 3 ? (
                              <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-100">
                                +{fields.length - 3}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No fields</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        <Badge color={p.active ? "green" : "default"}>
                          {p.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <ProductRowActions
                          product={{
                            id: p.id,
                            name: p.name,
                            sku: p.sku,
                            description: p.description,
                            unitPrice: Number(p.unitPrice),
                            taxPercent: Number(p.taxPercent),
                            category: p.category,
                            imageUrl: p.imageUrl,
                            active: p.active,
                            formFields: fields,
                            priceRule: rule,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                          <Package className="h-6 w-6" />
                        </div>
                        <p className="font-semibold text-slate-800">
                          No products found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Clear filters or design a new package on the right.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="h-fit overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:sticky xl:top-4">
          <div className="border-b border-slate-100 bg-gradient-to-br from-[#ef1e1e]/[0.06] to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ef1e1e] text-white shadow-sm shadow-red-500/25">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Design new product
                </h2>
                <p className="text-[11px] text-slate-500">
                  Price, % rules & fill-in blanks for New Sale
                </p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <ProductEditor />
          </div>
        </div>
      </div>
    </div>
  );
}
