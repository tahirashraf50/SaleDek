"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const DASHBOARD_RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
] as const;

export type DashboardRangeId = (typeof DASHBOARD_RANGES)[number]["id"];

type Props = {
  rangeId: DashboardRangeId;
  from: string;
  to: string;
  label: string;
  compact?: boolean;
  /** Preserve dashboard view tab in the URL */
  view?: string;
};

export function DashboardDateRange({
  rangeId,
  from,
  to,
  label,
  view,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function navigate(next: {
    range: DashboardRangeId;
    from?: string;
    to?: string;
  }) {
    const qs = new URLSearchParams();
    if (view && view !== "both") qs.set("view", view);
    qs.set("range", next.range);
    if (next.range === "custom" && next.from && next.to) {
      qs.set("from", next.from);
      qs.set("to", next.to);
    }
    start(() => {
      router.push(`/dashboard?${qs.toString()}`, { scroll: false });
    });
    setOpen(false);
  }

  function applyCustom() {
    if (!draftFrom || !draftTo) return;
    if (draftFrom > draftTo) {
      navigate({ range: "custom", from: draftTo, to: draftFrom });
      return;
    }
    navigate({ range: "custom", from: draftFrom, to: draftTo });
  }

  return (
    <div ref={rootRef} className="relative z-30 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className={cn(
          "inline-flex h-9 max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50",
          open && "border-slate-300 bg-slate-50 ring-2 ring-slate-100"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Change date range"
      >
        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate">{label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-400 transition",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Date range"
          className="absolute right-0 top-[calc(100%+8px)] w-[min(320px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10"
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Quick ranges
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DASHBOARD_RANGES.filter((r) => r.id !== "custom").map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={pending}
                onClick={() => navigate({ range: r.id })}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition",
                  rangeId === r.id
                    ? "bg-[#ef1e1e] text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="my-3 border-t border-slate-100" />

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Custom range
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-slate-500">From</p>
              <Input
                type="date"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="h-9 w-full text-xs"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-slate-500">To</p>
              <Input
                type="date"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
                className="h-9 w-full text-xs"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-3 h-9 w-full bg-[#ef1e1e] text-white hover:bg-[#d41919]"
            disabled={pending || !draftFrom || !draftTo}
            onClick={applyCustom}
          >
            Apply range
          </Button>
        </div>
      ) : null}
    </div>
  );
}
