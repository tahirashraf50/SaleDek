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
    const users = await db.user.count();
    return users === 0;
  } catch {
    // Table missing / DB error → allow first-time setup
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

async function runBootstrap() {
  const { spawnSync } = await import("node:child_process");
  const path = await import("node:path");

  const script = path.join(process.cwd(), "scripts", "db-bootstrap.mjs");
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: false,
    timeout: 180_000,
  });

  return {
    status: result.status,
    error: result.error?.message ?? null,
    stdout: (result.stdout || "").slice(0, 4000),
    stderr: (result.stderr || "").slice(0, 4000),
  };
}

export async function GET(req: NextRequest) {
  const openBootstrap = await needsBootstrap();

  if (!authorized(req, openBootstrap)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unauthorized. DB already has users — pass ?key= equal to Hostinger AUTH_SECRET (URL-encode special characters).",
        authSecretSet: Boolean(cleanSecret(process.env.AUTH_SECRET)),
        tip: "Example: /api/setup-db?key=" + encodeURIComponent("your-auth-secret-here"),
      },
      { status: 401 },
    );
  }

  const before = {
    openBootstrap,
    users: null as number | null,
  };
  try {
    before.users = await db.user.count();
  } catch {
    before.users = null;
  }

  const bootstrap = await runBootstrap();

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

  const ok = connected && (users ?? 0) > 0;
  return NextResponse.json(
    {
      ok,
      before,
      bootstrap,
      connected,
      users,
      dbError,
      hint: ok
        ? "Ready — login at /login with admin@demo.com / demo1234"
        : "Bootstrap finished but DB still not ready — check bootstrap.stdout/stderr",
    },
    { status: ok ? 200 : 500 },
  );
}
