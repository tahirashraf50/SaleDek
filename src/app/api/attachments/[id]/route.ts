import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const attachment = await db.attachment.findFirst({
    where: { id },
    include: { ticket: true, customer: true },
  });

  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orgId = session.user.organizationId;
  const ticketOrg = attachment.ticket?.organizationId;
  const customerOrg = attachment.customer?.organizationId;
  // ticket relation doesn't include org on Attachment directly - check via ticket
  if (attachment.ticketId) {
    const ticket = await db.ticket.findFirst({
      where: { id: attachment.ticketId, organizationId: orgId },
    });
    if (!ticket) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (attachment.customerId) {
    const customer = await db.customer.findFirst({
      where: { id: attachment.customerId, organizationId: orgId },
    });
    if (!customer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (ticketOrg && ticketOrg !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (customerOrg && customerOrg !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await readFile(attachment.filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${attachment.fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
