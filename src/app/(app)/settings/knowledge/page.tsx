import Link from "next/link";
import {
  BookOpen,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";
import {
  createKnowledgeArticle,
  updateKnowledgeArticle,
} from "@/server/actions/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

async function createAction(formData: FormData) {
  "use server";
  await createKnowledgeArticle({
    title: String(formData.get("title") || ""),
    category: String(formData.get("category") || "") || undefined,
    body: String(formData.get("body") || ""),
  });
}

async function toggleAction(formData: FormData) {
  "use server";
  await updateKnowledgeArticle(String(formData.get("id")), {
    active: formData.get("active") === "true",
  });
}

export default async function KnowledgeSettingsPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;

  const baseWhere = { organizationId: session.organizationId };

  const [articles, totalAll, activeCount, inactiveCount] = await Promise.all([
    db.knowledgeArticle.findMany({
      where: {
        ...baseWhere,
        ...(statusFilter === "active" ? { active: true } : {}),
        ...(statusFilter === "inactive" ? { active: false } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" as const } },
                { body: { contains: query, mode: "insensitive" as const } },
                {
                  category: { contains: query, mode: "insensitive" as const },
                },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.knowledgeArticle.count({ where: baseWhere }),
    db.knowledgeArticle.count({ where: { ...baseWhere, active: true } }),
    db.knowledgeArticle.count({ where: { ...baseWhere, active: false } }),
  ]);

  function href(next: { q?: string; status?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const status = next.status !== undefined ? next.status : params.status;
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    const s = qs.toString();
    return s ? `/settings/knowledge?${s}` : "/settings/knowledge";
  }

  const statusChips = [
    { id: "", label: "All", count: totalAll },
    { id: "active", label: "Active", count: activeCount },
    { id: "inactive", label: "Inactive", count: inactiveCount },
  ];

  const categories = new Set(
    articles.map((a) => a.category).filter(Boolean) as string[]
  ).size;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Knowledge base
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Internal articles suggested on ticket detail · {articles.length}
            {query || statusFilter ? " matching" : " shown"}
            {totalAll !== articles.length ? ` of ${totalAll}` : ""}
          </p>
        </div>
        <form action="/settings/knowledge" method="get" className="flex gap-2">
          {statusFilter ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              placeholder="Search articles…"
              defaultValue={query || ""}
              className="h-10 w-64 border-slate-200 bg-white pl-9 shadow-sm sm:w-72"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10 bg-white">
            Search
          </Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Articles</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} active · {inactiveCount} off
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-700 text-white shadow-md shadow-cyan-700/25">
              <BookOpen className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Published</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Visible to agents</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Categories</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{categories}</p>
          <p className="mt-1 text-[11px] text-slate-400">In current list</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Shown</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{articles.length}</p>
          <p className="mt-1 text-[11px] text-slate-400">After filters</p>
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
                  ? "bg-cyan-700 text-white shadow-sm shadow-cyan-700/25"
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-1 rounded-sm bg-cyan-700" />
              <h2 className="text-base font-semibold text-slate-900">
                All articles
              </h2>
            </div>
            <p className="text-xs text-slate-400">Agent assist library</p>
          </div>
          <div className="divide-y divide-slate-50">
            {articles.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-4 px-5 py-4 transition hover:bg-slate-50/80",
                  !a.active && "opacity-70"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{a.title}</p>
                    {a.active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Inactive
                      </span>
                    )}
                    {a.category ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-800 ring-1 ring-cyan-100">
                        <FolderOpen className="h-3 w-3" />
                        {a.category}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
                    {a.body}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Updated {formatDate(a.updatedAt)}
                  </p>
                </div>
                <form action={toggleAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={a.active ? "false" : "true"}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="h-8 bg-white text-xs"
                  >
                    {a.active ? "Disable" : "Enable"}
                  </Button>
                </form>
              </div>
            ))}
            {articles.length === 0 && (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <BookOpen className="h-6 w-6" />
                </div>
                <p className="font-semibold text-slate-800">No articles yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create one on the right for agent assist.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="h-fit overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:sticky xl:top-4">
          <div className="border-b border-slate-100 bg-gradient-to-br from-cyan-50/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-700 text-white shadow-sm shadow-cyan-700/25">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  New article
                </h2>
                <p className="text-[11px] text-slate-500">
                  Billing, technical, process…
                </p>
              </div>
            </div>
          </div>
          <form action={createAction} className="space-y-3.5 p-5">
            <div>
              <Label>Title</Label>
              <Input
                name="title"
                required
                placeholder="How to process a refund"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input
                name="category"
                placeholder="Billing, Technical…"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                name="body"
                required
                rows={8}
                placeholder="Step-by-step guidance for agents…"
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-cyan-700 text-white hover:bg-cyan-800"
            >
              <Plus className="h-4 w-4" />
              Create article
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
