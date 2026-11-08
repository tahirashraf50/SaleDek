import { NextRequest, NextResponse } from "next/server";
import { OmniChannel } from "@prisma/client";
import { db } from "@/lib/db";
import { ingestInboundMessage } from "@/lib/connectors";

const allowed: OmniChannel[] = ["WHATSAPP", "EMAIL", "CALL", "PORTAL"];

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgSlug: string; channel: string }> }
) {
  const { orgSlug, channel: channelRaw } = await ctx.params;
  const channel = channelRaw.toUpperCase() as OmniChannel;
  if (!allowed.includes(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const connectorIdHint =
    req.nextUrl.searchParams.get("connectorId") ||
    (body?.connectorId ? String(body.connectorId) : null);
  const externalKeyHint =
    req.nextUrl.searchParams.get("externalKey") ||
    (body?.phoneNumberId ? String(body.phoneNumberId) : null) ||
    (body?.toEmail ? String(body.toEmail).toLowerCase() : null);

  let connector = connectorIdHint
    ? await db.channelConnector.findFirst({
        where: {
          id: connectorIdHint,
          organizationId: org.id,
          channel,
        },
      })
    : null;

  if (!connector && externalKeyHint) {
    connector = await db.channelConnector.findFirst({
      where: {
        organizationId: org.id,
        channel,
        externalKey: externalKeyHint,
      },
    });
  }

  if (!connector) {
    const matches = await db.channelConnector.findMany({
      where: { organizationId: org.id, channel, enabled: true, mode: "WEBHOOK" },
      orderBy: { createdAt: "asc" },
    });
    if (matches.length === 1) connector = matches[0];
    else if (matches.length > 1) {
      return NextResponse.json(
        {
          error:
            "Multiple connectors for this channel — pass connectorId or externalKey",
          connectors: matches.map((c) => ({
            id: c.id,
            name: c.name,
            externalKey: c.externalKey,
          })),
        },
        { status: 400 }
      );
    } else {
      connector = await db.channelConnector.findFirst({
        where: { organizationId: org.id, channel },
        orderBy: { createdAt: "asc" },
      });
    }
  }

  if (!connector || !connector.enabled) {
    return NextResponse.json({ error: "Connector disabled" }, { status: 403 });
  }

  if (connector.mode === "WEBHOOK") {
    const secret =
      req.headers.get("x-webhook-secret") ||
      req.nextUrl.searchParams.get("secret");
    if (!secret || secret !== connector.webhookSecret) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }
  } else {
    return NextResponse.json(
      { error: "Connector is UI_ONLY — switch mode to WEBHOOK in settings" },
      { status: 400 }
    );
  }

  if (!body?.externalRef || !body?.body) {
    return NextResponse.json(
      { error: "externalRef and body required" },
      { status: 400 }
    );
  }

  const result = await ingestInboundMessage(org.id, {
    channel,
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
