import Link from "next/link";
import {
  MessageSquareText,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { OmniChannel } from "@prisma/client";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
  seedDefaultQuickReplies,
} from "@/server/actions/quick-replies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

async function createAction(formData: FormData) {
  "use server";
  const channelRaw = String(formData.get("channel") || "");
  await createQuickReply({
    title: String(formData.get("title") || ""),
    body: String(formData.get("body") || ""),
    shortcut: String(formData.get("shortcut") || "") || undefined,
    channel: channelRaw ? (channelRaw as OmniChannel) : null,
  });
}

async function toggleAction(formData: FormData) {
  "use server";
  await updateQuickReply(String(formData.get("id")), {
    active: formData.get("active") === "true",
  });
}

async function deleteAction(formData: FormData) {
  "use server";
  await deleteQuickReply(String(formData.get("id")));
}

async function seedAction() {
  "use server";
  await seedDefaultQuickReplies();
}

export default async function QuickRepliesSettingsPage({ searchParams }: Props) {
  const session = await requireOrgSession();
  const params = await searchParams;
  const query = params.q?.trim();
  const statusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : undefined;

  const baseWhere = { organizationId: session.organizationId };

  const [replies, totalAll, activeCount, inactiveCount] = await Promise.all([
    db.quickReply.findMany({
      where: {
        ...baseWhere,
        ...(statusFilter === "active" ? { active: true } : {}),
        ...(statusFilter === "inactive" ? { active: false } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { body: { contains: query } },
                { shortcut: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    db.quickReply.count({ where: baseWhere }),
    db.quickReply.count({ where: { ...baseWhere, active: true } }),
    db.quickReply.count({ where: { ...baseWhere, active: false } }),
  ]);

  function href(next: { q?: string; status?: string }) {
    const qs = new URLSearchParams();
    const q = next.q !== undefined ? next.q : query;
    const status = next.status !== undefined ? next.status : params.status;
    if (q) qs.set("q", q);
    if (status) qs.set("status", status);
    const s = qs.toString();
    return s ? `/settings/quick-replies?${s}` : "/settings/quick-replies";
  }

  const statusChips = [
    { id: "", label: "All", count: totalAll },
    { id: "active", label: "Active", count: activeCount },
    { id: "inactive", label: "Inactive", count: inactiveCount },
  ];

  const withShortcut = replies.filter((r) => r.shortcut).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
            Quick replies
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Canned replies for Inbox — tap Quick or type{" "}
            <code className="rounded bg-slate-100 px-1 text-[11px]">/hi</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={seedAction}>
            <Button type="submit" variant="outline" className="h-10 bg-white">
              <Sparkles className="h-3.5 w-3.5" />
              Seed defaults
            </Button>
          </form>
          <form action="/settings/quick-replies" method="get" className="flex gap-2">
            {statusFilter ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                name="q"
                placeholder="Search replies…"
                defaultValue={query || ""}
                className="h-10 w-56 border-slate-200 bg-white pl-9 shadow-sm sm:w-64"
              />
            </div>
            <Button type="submit" variant="outline" className="h-10 bg-white">
              Search
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">Replies</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{totalAll}</p>
              <p className="mt-1 text-[11px] text-slate-400">
                {activeCount} active · {inactiveCount} off
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ac16e0] text-white shadow-md shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]">
              <MessageSquareText className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{activeCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Ready in Inbox</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">With shortcut</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{withShortcut}</p>
          <p className="mt-1 text-[11px] text-slate-400">In current list</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
          <p className="text-sm text-slate-500">Shown</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{replies.length}</p>
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
                  ? "bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]"
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
              <span className="h-4 w-1 rounded-sm bg-[#ac16e0]" />
              <h2 className="text-base font-semibold text-slate-900">
                All replies
              </h2>
            </div>
            <p className="text-xs text-slate-400">Inbox compose helpers</p>
          </div>
          <div className="divide-y divide-slate-50">
            {replies.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-4 px-5 py-4 transition hover:bg-slate-50/80",
                  !r.active && "opacity-70"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{r.title}</p>
                    {r.active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Off
                      </span>
                    )}
                    {r.shortcut ? (
                      <span className="rounded-md bg-[rgba(172,22,224,0.08)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.15)]">
                        /{r.shortcut.replace(/^\//, "")}
                      </span>
                    ) : null}
                    {r.channel ? (
                      <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-100">
                        {r.channel}
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100">
                        All channels
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-sm text-slate-500">
                    {r.body}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={toggleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={r.active ? "false" : "true"}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="h-8 bg-white text-xs"
                    >
                      {r.active ? "Disable" : "Enable"}
                    </Button>
                  </form>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs text-rose-600"
                    >
                      Delete
                    </Button>
                  </form>
                </div>
              </div>
            ))}
            {replies.length === 0 && (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <MessageSquareText className="h-6 w-6" />
                </div>
                <p className="font-semibold text-slate-800">No quick replies</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create one or click Seed defaults.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="h-fit overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)] xl:sticky xl:top-4">
          <div className="border-b border-slate-100 bg-gradient-to-br from-[#f6f3fb]/80 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]">
                <Plus className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  New reply
                </h2>
                <p className="text-[11px] text-slate-500">
                  Greeting, hold, or closing
                </p>
              </div>
            </div>
          </div>
          <form action={createAction} className="space-y-3.5 p-5">
            <div>
              <Label>Title</Label>
              <Input name="title" required placeholder="Greeting" className="mt-1" />
            </div>
            <div>
              <Label>Shortcut</Label>
              <Input
                name="shortcut"
                placeholder="hi → becomes /hi"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Channel</Label>
              <Select name="channel" defaultValue="WHATSAPP" className="mt-1">
                <option value="">All channels</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="PORTAL">Portal</option>
              </Select>
            </div>
            <div>
              <Label>Message body</Label>
              <Textarea
                name="body"
                required
                rows={4}
                placeholder="Reply text…"
                className="mt-1"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#ac16e0] text-white hover:bg-[#8b10b8]"
            >
              <Plus className="h-4 w-4" />
              Save quick reply
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
