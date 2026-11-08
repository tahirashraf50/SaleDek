"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { updateDealStage } from "@/server/actions/sales";
import { formatCurrency, formatDate } from "@/lib/utils";

type Stage = {
  id: string;
  name: string;
  isWon: boolean;
  isLost: boolean;
};

type Deal = {
  id: string;
  number: number;
  title: string;
  value: number;
  stageId: string;
  closeDate: string | Date | null;
  customer: { id: string; name: string };
};

export function DealBoard({
  stages,
  deals: initial,
}: {
  stages: Stage[];
  deals: Deal[];
}) {
  const [deals, setDeals] = useState(initial);
  const [, start] = useTransition();

  function move(dealId: string, stageId: string) {
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stageId } : d))
    );
    start(async () => {
      try {
        await updateDealStage(dealId, stageId);
        toast.success("Deal stage updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const column = deals.filter((d) => d.stageId === stage.id);
        return (
          <div
            key={stage.id}
            className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const dealId = e.dataTransfer.getData("dealId");
              if (dealId) move(dealId, stage.id);
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="text-sm font-semibold">{stage.name}</span>
              <Badge color={stage.isWon ? "green" : stage.isLost ? "red" : "teal"}>
                {column.length}
              </Badge>
            </div>
            <div className="max-h-[65vh] space-y-2 overflow-y-auto p-2">
              {column.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("dealId", d.id)}
                  className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="text-sm font-medium text-slate-900">
                    #{d.number} {d.title}
                  </div>
                  <div className="text-sm text-[#8b10b8]">
                    {formatCurrency(d.value)}
                  </div>
                  <Link
                    href={`/customers/${d.customer.id}`}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    {d.customer.name}
                  </Link>
                  {d.closeDate && (
                    <div className="mt-1 text-[10px] text-slate-400">
                      Close {formatDate(d.closeDate)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
