import { ActivityType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function logActivity(params: {
  organizationId: string;
  userId?: string | null;
  customerId?: string | null;
  ticketId?: string | null;
  dealId?: string | null;
  orderId?: string | null;
  type: ActivityType;
  title: string;
  body?: string;
  meta?: Prisma.InputJsonValue;
}) {
  return db.activity.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId ?? undefined,
      customerId: params.customerId ?? undefined,
      ticketId: params.ticketId ?? undefined,
      dealId: params.dealId ?? undefined,
      orderId: params.orderId ?? undefined,
      type: params.type,
      title: params.title,
      body: params.body,
      meta: params.meta,
    },
  });
}
