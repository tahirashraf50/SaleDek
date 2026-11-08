"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Agent = { id: string; name: string };

type Props = {
  value: string | null;
  agents: Agent[];
  compact?: boolean;
  className?: string;
  onAssign: (assigneeId: string | null) => Promise<{
    assigneeName?: string | null;
  }>;
};

export function ModuleAssign({
  value,
  agents,
  compact,
  className,
  onAssign,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value || null;
    start(async () => {
      try {
        const res = await onAssign(next);
        toast.success(
          res.assigneeName ? `Assigned to ${res.assigneeName}` : "Unassigned"
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
        value={value || ""}
        onChange={onChange}
        disabled={pending}
        className={cn(
          "bg-white",
          compact ? "h-8 max-w-[160px] text-[11px]" : "h-8 text-xs"
        )}
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
