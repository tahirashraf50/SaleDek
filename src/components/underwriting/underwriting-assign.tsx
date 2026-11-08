"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { assignUnderwritingCase } from "@/server/actions/underwriting";
import { cn } from "@/lib/utils";

export type UwAgent = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Props = {
  orderId: string;
  assigneeId: string | null;
  agents: UwAgent[];
  compact?: boolean;
  className?: string;
};

export function UnderwritingAssign({
  orderId,
  assigneeId,
  agents,
  compact,
  className,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value || null;
    start(async () => {
      try {
        const res = await assignUnderwritingCase(orderId, next);
        toast.success(
          res.assigneeName
            ? `Assigned to ${res.assigneeName}`
            : "Unassigned"
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Assign failed");
      }
    });
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {!compact ? (
        <UserPlus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      ) : null}
      <Select
        value={assigneeId || ""}
        onChange={onChange}
        disabled={pending}
        className={cn(
          "bg-white",
          compact ? "h-8 max-w-[160px] text-[11px]" : "h-8 text-xs"
        )}
        aria-label="Assign underwriting agent"
      >
        <option value="">Unassigned</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
