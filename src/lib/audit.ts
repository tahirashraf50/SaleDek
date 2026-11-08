import { db } from "@/lib/db";

export async function writeAudit(params: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  await db.auditLog.create({
    data: {
      organizationId: params.organizationId ?? undefined,
      userId: params.userId ?? undefined,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      meta: params.meta as object | undefined,
    },
  });
}
