import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase, ensureDbCwd } from "@/lib/ensure-db";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.AUTH_SECRET || process.env.SETUP_SECRET || "";
  if (!secret) return false;
  const header = req.headers.get("x-setup-key") || "";
  const query = req.nextUrl.searchParams.get("key") || "";
  return header === secret || query === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized. Call /api/setup-db?key=YOUR_AUTH_SECRET (same value as Hostinger AUTH_SECRET).",
      },
      { status: 401 },
    );
  }

  const before = {
    cwd: ensureDbCwd(),
    users: null as number | null,
  };
  try {
    before.users = await db.user.count();
  } catch {
    before.users = null;
  }

  const result = ensureDatabase();

  let users: number | null = null;
  let connected = false;
  try {
    await db.$queryRaw`SELECT 1`;
    connected = true;
    users = await db.user.count();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        before,
        result,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
        hint: "Open Hostinger logs for prisma output",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: result.ok && connected && (users ?? 0) > 0,
    before,
    result,
    connected,
    users,
    hint:
      (users ?? 0) > 0
        ? "Ready — login at /login with admin@demo.com / demo1234"
        : "Tables may exist but seed created no users — check seed step output",
  });
}
