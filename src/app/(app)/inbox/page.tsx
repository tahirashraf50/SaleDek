import { Prisma } from "@prisma/client";
import { requireOrgSession } from "@/lib/session";
import { db } from "@/lib/db";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";

export default async function InboxPage() {
  const session = await requireOrgSession();
  const organizationId = session.organizationId;
  const role = session.user.role;
  const userId = session.user.id;

  const isDeptUser = role === "DEPARTMENT_USER";
  const isPrivileged = role === "ORG_ADMIN" || role === "MANAGER" || role === "SUPER_ADMIN";
  const isAgentScoped = role === "AGENT" || role === "VIEWER";

  const conversationWhere: Prisma.ConversationWhereInput = {
    organizationId,
    ...(isDeptUser
      ? { assigneeId: userId }
      : isAgentScoped
        ? {
            OR: [
              { assigneeId: userId },
              { connector: { assigneeId: userId } },
            ],
          }
        : {}),
  };

  const [
    conversations,
    callLogs,
    departments,
    ticketTypes,
    myConnectors,
    quickReplies,
    products,
  ] = await Promise.all([
    db.conversation.findMany({
      where: conversationWhere,
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        connector: {
          select: {
            id: true,
            name: true,
            channel: true,
            assigneeId: true,
            assignee: { select: { id: true, name: true } },
          },
        },
        messages: { orderBy: { sentAt: "asc" } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
    db.callLog.findMany({
      where: {
        organizationId,
        ...(isAgentScoped ? { agentId: userId } : {}),
      },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    db.department.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.ticketType.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    isAgentScoped
      ? db.channelConnector.findMany({
          where: { organizationId, assigneeId: userId, enabled: true },
          select: { id: true, name: true, channel: true },
          orderBy: { name: "asc" },
        })
      : db.channelConnector.findMany({
          where: { organizationId, enabled: true },
          select: { id: true, name: true, channel: true },
          orderBy: [{ channel: "asc" }, { name: "asc" }],
        }),
    db.quickReply.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        title: true,
        body: true,
        shortcut: true,
        channel: true,
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    db.product.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        name: true,
        sku: true,
        unitPrice: true,
        imageUrl: true,
        whatsappProductId: true,
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const serialized = conversations.map((c) => ({
    ...c,
    lastMessageAt: c.lastMessageAt.toISOString(),
    messages: c.messages.map((m) => ({
      ...m,
      sentAt: m.sentAt.toISOString(),
      meta:
        m.meta && typeof m.meta === "object"
          ? (m.meta as Record<string, unknown>)
          : null,
    })),
  }));

  const calls = callLogs.map((c) => ({
    ...c,
    startedAt: c.startedAt.toISOString(),
  }));

  return (
    <InboxWorkspace
      conversations={serialized}
      callLogs={calls}
      departments={departments}
      ticketTypes={ticketTypes}
      channelLines={myConnectors}
      scopedAgent={!isPrivileged && !isDeptUser && isAgentScoped}
      quickReplies={quickReplies}
      products={products.map((p) => ({
        ...p,
        unitPrice: Number(p.unitPrice),
      }))}
    />
  );
}
