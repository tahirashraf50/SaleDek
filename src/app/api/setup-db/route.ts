import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function cleanSecret(value: string | undefined): string {
  return (value || "").trim().replace(/^['"]|['"]$/g, "");
}

async function needsBootstrap(): Promise<boolean> {
  try {
    return (await db.user.count()) === 0;
  } catch {
    return true;
  }
}

function authorized(req: NextRequest, allowOpenBootstrap: boolean): boolean {
  if (allowOpenBootstrap) return true;
  const secret = cleanSecret(process.env.AUTH_SECRET || process.env.SETUP_SECRET);
  if (!secret) return false;
  const header = cleanSecret(req.headers.get("x-setup-key") || "");
  const query = cleanSecret(req.nextUrl.searchParams.get("key") || "");
  return header === secret || query === secret;
}

export async function GET(req: NextRequest) {
  const openBootstrap = await needsBootstrap();

  if (!authorized(req, openBootstrap)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized. DB already has users — pass ?key= equal to Hostinger AUTH_SECRET.",
        authSecretSet: Boolean(cleanSecret(process.env.AUTH_SECRET)),
      },
      { status: 401 },
    );
  }

  // Dynamic import keeps this Node-only path out of Edge bundles.
  const { bootstrapMysql } = await import("@/lib/bootstrap-mysql");
  const bootstrap = await bootstrapMysql();

  let users: number | null = null;
  let connected = false;
  let dbError: string | null = null;
  try {
    await db.$queryRaw`SELECT 1`;
    connected = true;
    users = await db.user.count();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const ok = bootstrap.ok && connected && (users ?? 0) > 0;
  return NextResponse.json(
    {
      ok,
      cwd: process.cwd(),
      bootstrap,
      connected,
      users,
      dbError,
      hint: ok
        ? "Ready — login at /login with admin@demo.com / demo1234"
        : "Bootstrap failed — check bootstrap.error / bootstrap.logs",
    },
    { status: ok ? 200 : 500 },
  );
}
