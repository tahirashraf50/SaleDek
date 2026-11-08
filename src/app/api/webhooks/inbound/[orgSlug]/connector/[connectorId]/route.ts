import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestInboundMessage } from "@/lib/connectors";

/** Preferred webhook URL for a specific channel instance (multi WA / email). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgSlug: string; connectorId: string }> }
) {
  const { orgSlug, connectorId } = await ctx.params;

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const connector = await db.channelConnector.findFirst({
    where: { id: connectorId, organizationId: org.id },
  });
  if (!connector || !connector.enabled) {
    return NextResponse.json({ error: "Connector disabled" }, { status: 403 });
  }

  if (connector.mode !== "WEBHOOK") {
    return NextResponse.json(
      { error: "Connector is UI_ONLY — switch mode to WEBHOOK in settings" },
      { status: 400 }
    );
  }

  const secret =
    req.headers.get("x-webhook-secret") ||
    req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== connector.webhookSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.externalRef || !body?.body) {
    return NextResponse.json(
      { error: "externalRef and body required" },
      { status: 400 }
    );
  }

  const result = await ingestInboundMessage(org.id, {
    channel: connector.channel,
    connectorId: connector.id,
    externalRef: String(body.externalRef),
    body: String(body.body),
    subject: body.subject ? String(body.subject) : undefined,
    customerName: body.customerName ? String(body.customerName) : undefined,
    customerPhone: body.customerPhone ? String(body.customerPhone) : undefined,
    customerEmail: body.customerEmail ? String(body.customerEmail) : undefined,
    meta: body.meta,
  });

  return NextResponse.json({ ok: true, ...result });
}
