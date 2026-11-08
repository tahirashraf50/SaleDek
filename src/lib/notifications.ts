import { db } from "@/lib/db";

export async function notifyUser(params: {
  organizationId: string;
  userId: string;
  title: string;
  body?: string;
  href?: string;
}) {
  return db.notification.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      title: params.title,
      body: params.body,
      href: params.href,
    },
  });
}
