"use client";

import { assignOperationsCase } from "@/server/actions/operations";
import { ModuleAssign } from "@/components/modules/module-assign";

export function OperationsAssign({
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
      onAssign={(id) => assignOperationsCase(orderId, id)}
    />
  );
}
