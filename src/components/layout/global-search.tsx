"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  Handshake,
  Loader2,
  Package,
  Search,
  Ticket,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Result = {
  customers: { id: string; name: string; phone: string | null }[];
  tickets: { id: string; number: number; subject: string }[];
  deals: { id: string; number: number; title: string }[];
  products: { id: string; name: string }[];
};

function ResultRow({
  icon: Icon,
  label,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  subtitle?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-[#f6f3fb]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f6f3fb] text-[#ac16e0]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">
          {title}
        </span>
        {subtitle ? (
          <span className="block truncate text-[11px] text-slate-400">
            {subtitle}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ring-1 ring-[#eee8f5]">
        {label}
      </span>
    </button>
  );
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setData(null);
      setLoading(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setData(await res.json());
        else setData(null);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  function go(href: string) {
    onOpenChange(false);
    setQ("");
    router.push(href);
  }

  const total =
    (data?.customers.length || 0) +
    (data?.tickets.length || 0) +
    (data?.deals.length || 0) +
    (data?.products.length || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-xl overflow-hidden border-[#eee8f5] p-0 shadow-[0_28px_60px_-28px_rgba(172,22,224,0.45)]",
          "[&>button]:right-3 [&>button]:top-3 [&>button]:rounded-lg [&>button]:p-1.5 [&>button]:text-slate-400 [&>button]:hover:bg-[#f6f3fb] [&>button]:hover:text-[#ac16e0]"
        )}
      >
        <DialogHeader className="border-b border-[#eee8f5] px-0 py-0">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-2.5 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-[#ac16e0]" />
            <input
              autoFocus
              placeholder="Search customers, tickets, deals, products…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            {loading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#ac16e0]" />
            ) : (
              <kbd className="hidden items-center gap-0.5 rounded-md bg-[#f6f3fb] px-1.5 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-[#eee8f5] sm:inline-flex">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[min(52vh,380px)] overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-slate-600">
                Start typing to search
              </p>
              <p className="mt-1 text-xs text-slate-400">
                At least 2 characters · customers, tickets, deals, products
              </p>
            </div>
          ) : loading && !data ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-[#ac16e0]" />
              Searching…
            </div>
          ) : total === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-slate-600">No results</p>
              <p className="mt-1 text-xs text-slate-400">
                Nothing matched “{q.trim()}”
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data!.customers.length > 0 ? (
                <section>
                  <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Customers
                  </p>
                  {data!.customers.map((c) => (
                    <ResultRow
                      key={c.id}
                      icon={Users}
                      label="Customer"
                      title={c.name}
                      subtitle={c.phone}
                      onClick={() => go(`/customers/${c.id}`)}
                    />
                  ))}
                </section>
              ) : null}
              {data!.tickets.length > 0 ? (
                <section>
                  <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Tickets
                  </p>
                  {data!.tickets.map((t) => (
                    <ResultRow
                      key={t.id}
                      icon={Ticket}
                      label="Ticket"
                      title={`#${t.number} ${t.subject}`}
                      onClick={() => go(`/tickets/${t.id}`)}
                    />
                  ))}
                </section>
              ) : null}
              {data!.deals.length > 0 ? (
                <section>
                  <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Deals
                  </p>
                  {data!.deals.map((d) => (
                    <ResultRow
                      key={d.id}
                      icon={Handshake}
                      label="Deal"
                      title={`#${d.number} ${d.title}`}
                      onClick={() => go(`/sales/deals`)}
                    />
                  ))}
                </section>
              ) : null}
              {data!.products.length > 0 ? (
                <section>
                  <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Products
                  </p>
                  {data!.products.map((p) => (
                    <ResultRow
                      key={p.id}
                      icon={Package}
                      label="Product"
                      title={p.name}
                      onClick={() => go(`/sales/products`)}
                    />
                  ))}
                </section>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#eee8f5] bg-[#f6f3fb]/70 px-4 py-2 text-[10px] text-slate-400">
          <span>Enter to open · Esc to close</span>
          {total > 0 ? <span>{total} result{total === 1 ? "" : "s"}</span> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
