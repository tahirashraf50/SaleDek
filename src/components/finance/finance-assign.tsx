"use client";

import { assignFinanceCase } from "@/server/actions/finance";
import { ModuleAssign } from "@/components/modules/module-assign";

export function FinanceAssign({
  orderId,
  assigneeId,
  agents,
  compact,
}: {
  orderId: string;
  assigneeId: string | null;
  agents: { id: string; name: string }[];
  compact?: boolean;
}) {
  return (
    <ModuleAssign
      value={assigneeId}
      agents={agents}
      compact={compact}
      onAssign={(id) => assignFinanceCase(orderId, id)}
    />
  );
}
