import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redact(message: string): string {
  return message
    .replace(/mysql:\/\/[^@\s]+@/gi, "mysql://***@")
    .replace(/password[=:]\s*\S+/gi, "password=***")
    .slice(0, 280);
}

export async function GET() {
  const url = process.env.DATABASE_URL || "";
  const urlOk = url.startsWith("mysql://");
  const hostHint = urlOk
    ? url.replace(/^mysql:\/\/[^@]+@/, "").split("/")[0] || "?"
    : null;

  const body: Record<string, unknown> = {
    ok: false,
    app: "SaleDek",
    time: new Date().toISOString(),
    databaseUrlSet: Boolean(url),
    databaseUrlMysql: urlOk,
    hostHint,
    authSecretSet: Boolean(process.env.AUTH_SECRET),
  };

  if (!urlOk) {
    body.error =
      "DATABASE_URL missing or not mysql:// — set Hostinger MySQL URL (127.0.0.1).";
    return NextResponse.json(body, { status: 503 });
  }

  try {
    await db.$queryRaw`SELECT 1`;
    body.connected = true;

    const users = await db.user.count();
    body.users = users;
    body.tablesReady = true;
    body.ok = true;
    body.hint =
      users > 0
        ? "DB ready — login with admin@demo.com / demo1234"
        : "Tables exist but no users — seed did not run. Redeploy or run prisma db seed.";
    return NextResponse.json(body);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : undefined;
    const message = redact(err instanceof Error ? err.message : String(err));
    body.connected = false;
    body.tablesReady = false;
    body.code = code ?? null;
    body.error = message;

    if (code === "P1001") {
      body.hint =
        "Cannot reach MySQL. On Hostinger Node use host 127.0.0.1 (not remote srv host).";
    } else if (code === "P1000" || code === "P1010") {
      body.hint =
        "MySQL login failed. Check user/password; encode @ in password as %40.";
    } else if (code === "P2021" || /does not exist|Unknown table/i.test(message)) {
      body.hint =
        "Tables missing. Redeploy so start script runs migrate/db push.";
    } else {
      body.hint = "See Hostinger app logs for [db-bootstrap] lines.";
    }

    return NextResponse.json(body, { status: 503 });
  }
}
