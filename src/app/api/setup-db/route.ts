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

async function discoverRoot() {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const tried: string[] = [];
  const candidates = new Set<string>();

  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.add(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  candidates.add(path.join(process.cwd(), ".."));
  candidates.add(path.join(process.cwd(), "nodejs"));

  for (const candidate of candidates) {
    tried.push(candidate);
    const schema = path.join(candidate, "prisma", "schema.prisma");
    if (fs.existsSync(schema)) {
      return {
        root: candidate,
        schema,
        prismaCli: path.join(
          candidate,
          "node_modules",
          "prisma",
          "build",
          "index.js",
        ),
        bootstrap: path.join(candidate, "prisma", "db-bootstrap.mjs"),
        legacyBootstrap: path.join(candidate, "scripts", "db-bootstrap.mjs"),
        tried,
        listing: fs.readdirSync(candidate).slice(0, 40),
      };
    }
  }

  return {
    root: process.cwd(),
    schema: null as string | null,
    prismaCli: path.join(
      process.cwd(),
      "node_modules",
      "prisma",
      "build",
      "index.js",
    ),
    bootstrap: null as string | null,
    legacyBootstrap: null as string | null,
    tried,
    listing: fs.existsSync(process.cwd())
      ? fs.readdirSync(process.cwd()).slice(0, 40)
      : [],
  };
}

async function runPrisma(root: string, prismaCli: string, args: string[]) {
  const { spawnSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const path = await import("node:path");

  const cmd = fs.existsSync(prismaCli) ? process.execPath : "npx";
  const fullArgs = fs.existsSync(prismaCli)
    ? [prismaCli, ...args]
    : ["prisma", ...args];

  const result = spawnSync(cmd, fullArgs, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
    timeout: 180_000,
  });

  return {
    cmd: `${cmd} ${fullArgs.join(" ")}`,
    status: result.status,
    error: result.error?.message ?? null,
    stdout: (result.stdout || "").slice(0, 3000),
    stderr: (result.stderr || "").slice(0, 3000),
    schemaExists: fs.existsSync(path.join(root, "prisma", "schema.prisma")),
    cliExists: fs.existsSync(prismaCli),
  };
}

async function runBootstrap() {
  const fs = await import("node:fs");
  const { spawnSync } = await import("node:child_process");
  const discovered = await discoverRoot();

  // 1) Prefer prisma/db-bootstrap.mjs (deployed with schema)
  const script =
    (discovered.bootstrap && fs.existsSync(discovered.bootstrap)
      ? discovered.bootstrap
      : null) ||
    (discovered.legacyBootstrap && fs.existsSync(discovered.legacyBootstrap)
      ? discovered.legacyBootstrap
      : null);

  if (script) {
    const result = spawnSync(process.execPath, [script], {
      cwd: discovered.root,
      env: process.env,
      encoding: "utf8",
      shell: false,
      timeout: 180_000,
    });
    return {
      mode: "script" as const,
      script,
      discovered,
      status: result.status,
      error: result.error?.message ?? null,
      stdout: (result.stdout || "").slice(0, 4000),
      stderr: (result.stderr || "").slice(0, 4000),
      steps: [] as unknown[],
    };
  }

  // 2) No script on disk (Hostinger stripped scripts/) — call Prisma CLI directly
  if (!discovered.schema) {
    return {
      mode: "missing-schema" as const,
      discovered,
      status: 1,
      error: "prisma/schema.prisma not found in deploy directory",
      stdout: "",
      stderr: "",
      steps: [],
    };
  }

  const steps = [];
  let migrate = await runPrisma(discovered.root, discovered.prismaCli, [
    "migrate",
    "deploy",
  ]);
  steps.push({ name: "migrate deploy", ...migrate });

  if (migrate.status !== 0) {
    const push = await runPrisma(discovered.root, discovered.prismaCli, [
      "db",
      "push",
      "--skip-generate",
      "--accept-data-loss",
    ]);
    steps.push({ name: "db push", ...push });
    migrate = push;
  }

  const seed = await runPrisma(discovered.root, discovered.prismaCli, [
    "db",
    "seed",
  ]);
  steps.push({ name: "db seed", ...seed });

  return {
    mode: "inline-prisma" as const,
    discovered,
    status: migrate.status === 0 ? 0 : 1,
    error: null,
    stdout: steps.map((s) => s.stdout).join("\n"),
    stderr: steps.map((s) => s.stderr).join("\n"),
    steps,
  };
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

  const before = {
    openBootstrap,
    users: null as number | null,
    cwd: process.cwd(),
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
        : "Still failing — check bootstrap.discovered.listing and bootstrap.steps",
    },
    { status: ok ? 200 : 500 },
  );
}
