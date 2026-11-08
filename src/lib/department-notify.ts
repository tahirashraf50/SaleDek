import { db } from "@/lib/db";
import { notifyUser } from "@/lib/notifications";
import { sendEmailMessage } from "@/lib/integrations/email";

/** Notify department users: in-app notification + email + CRM Email inbox thread. */
export async function notifyDepartmentOfTicket(params: {
  organizationId: string;
  ticketId: string;
  departmentId: string;
  note?: string;
  forwardedByName?: string;
}) {
  const ticket = await db.ticket.findFirst({
    where: { id: params.ticketId, organizationId: params.organizationId },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      department: { select: { name: true } },
    },
  });
  if (!ticket || !ticket.departmentId) return { notified: 0 };

  const users = await db.user.findMany({
    where: {
      organizationId: params.organizationId,
      departmentId: params.departmentId,
      active: true,
    },
  });
  if (users.length === 0) return { notified: 0 };

  const connector = await db.channelConnector.findFirst({
    where: {
      organizationId: params.organizationId,
      channel: "EMAIL",
      enabled: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const config =
    connector?.config && typeof connector.config === "object"
      ? (connector.config as Record<string, unknown>)
      : {};

  const deptName = ticket.department?.name || "Department";
  const subject = `[SaleDek] Ticket #${ticket.number} → ${deptName}`;
  const body = [
    `A complaint was forwarded to ${deptName}.`,
    "",
    `Ticket: #${ticket.number}`,
    `Subject: ${ticket.subject}`,
    `Customer: ${ticket.customer.name}`,
    ticket.customer.phone ? `Phone: ${ticket.customer.phone}` : null,
    ticket.customer.email ? `Email: ${ticket.customer.email}` : null,
    `Priority: ${ticket.priority}`,
    params.forwardedByName ? `Forwarded by: ${params.forwardedByName}` : null,
    params.note ? `Note: ${params.note}` : null,
    "",
    `Open in portal: /tickets/${ticket.id}`,
    `Department queue: /department`,
  ]
    .filter(Boolean)
    .join("\n");

  let notified = 0;
  for (const user of users) {
    await notifyUser({
      organizationId: params.organizationId,
      userId: user.id,
      title: `Ticket #${ticket.number} forwarded to ${deptName}`,
      body: ticket.subject,
      href: `/tickets/${ticket.id}`,
    });

    if (user.email.includes("@")) {
      await sendEmailMessage(
        {
          smtpHost: String(config.smtpHost || ""),
          smtpPort: Number(config.smtpPort || 587),
          smtpUser: String(config.smtpUser || ""),
          smtpPass: String(config.smtpPass || ""),
          fromEmail: String(config.fromEmail || "noreply@pulsecrm.local"),
          mock: config.mock !== false,
        },
        user.email,
        subject,
        body
      );

      // Land in CRM Email inbox for this department user
      await db.conversation.create({
        data: {
          organizationId: params.organizationId,
          channel: "EMAIL",
          customerId: ticket.customerId,
          assigneeId: user.id,
          externalRef: user.email,
          subject,
          status: "OPEN",
          unreadCount: 1,
          lastMessageAt: new Date(),
          messages: {
            create: {
              direction: "IN",
              body,
              subject,
              meta: {
                kind: "DEPARTMENT_FORWARD",
                ticketId: ticket.id,
                ticketNumber: ticket.number,
                delivery: { mode: "MOCK", provider: "email" },
              },
            },
          },
        },
      });
    }

    notified += 1;
  }

  return { notified };
}
