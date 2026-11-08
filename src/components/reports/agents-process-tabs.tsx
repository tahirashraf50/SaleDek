"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Headphones, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "support" | "departments";

type Props = {
  initialTab: TabId;
  supportHref: string;
  departmentsHref: string;
  supportSummary: string;
  departmentsSummary: string;
  supportPanel: ReactNode;
  departmentsPanel: ReactNode;
};

export function AgentsProcessTabs({
  initialTab,
  supportHref,
  departmentsHref,
  supportSummary,
  departmentsSummary,
  supportPanel,
  departmentsPanel,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function select(next: TabId, href: string) {
    // Flip UI immediately; stacked panels keep page height stable
    setTab(next);
    router.replace(href, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => select("support", supportHref)}
          className={cn(
            "h-full rounded-2xl border p-4 text-left shadow-[0_4px_20px_rgba(15,23,42,0.04)] ring-1 transition",
            tab === "support"
              ? "border-[rgba(172,22,224,0.35)] bg-[rgba(172,22,224,0.08)] ring-[rgba(172,22,224,0.25)]"
              : "border-slate-100 bg-white ring-transparent hover:border-[rgba(172,22,224,0.25)]"
          )}
        >
          <div className="flex min-h-[52px] items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                tab === "support"
                  ? "bg-[#ac16e0] text-white"
                  : "bg-[rgba(172,22,224,0.08)] text-[#8b10b8]"
              )}
            >
              <Headphones className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">Customer Support</p>
              <p className="mt-0.5 text-xs text-slate-500">{supportSummary}</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => select("departments", departmentsHref)}
          className={cn(
            "h-full rounded-2xl border p-4 text-left shadow-[0_4px_20px_rgba(15,23,42,0.04)] ring-1 transition",
            tab === "departments"
              ? "border-violet-300 bg-violet-50/60 ring-violet-200"
              : "border-slate-100 bg-white ring-transparent hover:border-violet-200"
          )}
        >
          <div className="flex min-h-[52px] items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                tab === "departments"
                  ? "bg-violet-700 text-white"
                  : "bg-violet-50 text-violet-700"
              )}
            >
              <Wrench className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">Other departments</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {departmentsSummary}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Stack both panels so tab switches don't change page height */}
      <div className="grid">
        <div
          className={cn(
            "col-start-1 row-start-1 space-y-5",
            tab !== "support" && "invisible pointer-events-none"
          )}
          aria-hidden={tab !== "support"}
        >
          {supportPanel}
        </div>
        <div
          className={cn(
            "col-start-1 row-start-1 space-y-5",
            tab !== "departments" && "invisible pointer-events-none"
          )}
          aria-hidden={tab !== "departments"}
        >
          {departmentsPanel}
        </div>
      </div>
    </div>
  );
}
