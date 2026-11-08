import { db } from "@/lib/db";
import { ensureUnderwritingDepartment } from "@/lib/org-defaults";
import { notifyDepartmentOfTicket } from "@/lib/department-notify";
import { logActivity } from "@/lib/activity";
import { getOrgModule } from "@/lib/modules";

/** After a sale is created: open an Underwriting case (ticket) and queue the order. */
export async function routeSaleToUnderwriting(params: {
  organizationId: string;
  orderId: string;
  createdById?: string | null;
  createdByName?: string | null;
}) {
  const mod = await getOrgModule(params.organizationId, "UNDERWRITING");
  if (!mod?.enabled) return null;

  const order = await db.order.findFirst({
    where: { id: params.orderId, organizationId: params.organizationId },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      items: { select: { name: true } },
    },
  });
  if (!order) return null;

  const dept = mod.departmentId
    ? await db.department.findFirst({
        where: { id: mod.departmentId, organizationId: params.organizationId },
      })
    : await ensureUnderwritingDepartment(db, params.organizationId);
  if (!dept) return null;

  const stage = await db.ticketStage.findFirst({
    where: { organizationId: params.organizationId, key: "FORWARDED" },
  });
  if (!stage) return null;

  const org = await db.organization.update({
    where: { id: params.organizationId },
    data: { ticketCounter: { increment: 1 } },
  });

  const productLine = order.items
    .map((i) => i.name)
    .slice(0, 3)
    .join(", ");

  const ticket = await db.ticket.create({
    data: {
      organizationId: params.organizationId,
      number: org.ticketCounter,
      subject: `Underwriting — Order #${order.number}`,
      description: [
        `New sale requires policy issuance.`,
        ``,
        `Order: #${order.number}`,
        `Customer: ${order.customer.name}`,
        order.customer.phone ? `Phone: ${order.customer.phone}` : null,
        order.customer.email ? `Email: ${order.customer.email}` : null,
        `Total: ${Number(order.total)}`,
        productLine ? `Products: ${productLine}` : null,
        ``,
        `Process:`,
        `1) Allocate policy number`,
        `2) Attach final policy document`,
        `3) Issue & email to customer`,
      ]
        .filter(Boolean)
        .join("\n"),
      priority: "HIGH",
      channel: "OTHER",
      stageId: stage.id,
      customerId: order.customerId,
      departmentId: dept.id,
      createdById: params.createdById || null,
    },
  });

  if (params.createdById) {
    await db.ticketNote.create({
      data: {
        ticketId: ticket.id,
        authorId: params.createdById,
        body: "Auto-routed from New Sale → Underwriting queue.",
        isInternal: true,
      },
    });
  }

  await db.order.update({
    where: { id: order.id },
    data: {
      ticketId: ticket.id,
      underwritingStatus: "PENDING",
    },
  });

  await logActivity({
    organizationId: params.organizationId,
    userId: params.createdById || undefined,
    customerId: order.customerId,
    orderId: order.id,
    ticketId: ticket.id,
    type: "FORWARD",
    title: `Order #${order.number} → Underwriting`,
    body: "Awaiting policy number & document",
  });

  await notifyDepartmentOfTicket({
    organizationId: params.organizationId,
    ticketId: ticket.id,
    departmentId: dept.id,
    note: "New sale ready for policy issuance",
    forwardedByName: params.createdByName || "Sales",
  });

  return { ticketId: ticket.id, departmentId: dept.id };
}

export function policyEmailTemplate(input: {
  orgName: string;
  customerName: string;
  policyNumber: string;
  orderNumber: number;
}) {
  const subject = `Your Policy Document — ${input.policyNumber}`;
  const body = [
    `Dear ${input.customerName},`,
    ``,
    `Thank you for choosing ${input.orgName}.`,
    ``,
    `Your policy has been issued by our Underwriting team.`,
    ``,
    `Policy Number: ${input.policyNumber}`,
    `Order Reference: #${input.orderNumber}`,
    ``,
    `Please find your policy document attached to this email. Kindly keep it for your records.`,
    ``,
    `If you have any questions about your cover, reply to this email or contact our support team.`,
    ``,
    `Regards,`,
    `${input.orgName} Underwriting Team`,
  ].join("\n");

  return { subject, body };
}
