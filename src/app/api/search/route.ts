import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({
      customers: [],
      tickets: [],
      deals: [],
      products: [],
    });
  }

  const organizationId = session.user.organizationId;
  const [customers, tickets, deals, products] = await Promise.all([
    db.customer.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      select: { id: true, name: true, phone: true },
      take: 8,
    }),
    db.ticket.findMany({
      where: {
        organizationId,
        OR: [
          { subject: { contains: q } },
          ...(Number.isFinite(Number(q)) ? [{ number: Number(q) }] : []),
        ],
      },
      select: { id: true, number: true, subject: true },
      take: 8,
    }),
    db.deal.findMany({
      where: {
        organizationId,
        title: { contains: q },
      },
      select: { id: true, number: true, title: true },
      take: 8,
    }),
    db.product.findMany({
      where: {
        organizationId,
        name: { contains: q },
      },
      select: { id: true, name: true },
      take: 8,
    }),
  ]);

  return NextResponse.json({ customers, tickets, deals, products });
}
