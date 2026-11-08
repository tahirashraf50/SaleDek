"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchKnowledge } from "@/server/actions/knowledge";

type Article = {
  id: string;
  title: string;
  category: string | null;
  body: string;
};

export function KnowledgePanel({ seedQuery = "" }: { seedQuery?: string }) {
  const [q, setQ] = useState(seedQuery);
  const [items, setItems] = useState<Article[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const rows = await searchKnowledge(q);
      setItems(rows);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Suggested articles
        </h3>
      </div>
      <div className="p-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search knowledge…"
          className="mb-3"
        />
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {items.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpenId(openId === a.id ? null : a.id)}
              className="w-full rounded-md border border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
            >
              <div className="text-sm font-medium text-slate-800">{a.title}</div>
              {a.category ? (
                <div className="text-[11px] text-[#8b10b8]">{a.category}</div>
              ) : null}
              {openId === a.id ? (
                <div className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                  {a.body}
                </div>
              ) : null}
            </button>
          ))}
          {items.length === 0 ? (
            <div className="text-xs text-slate-400">No articles found</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
