import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type EnsureDbResult = {
  ok: boolean;
  steps: { name: string; ok: boolean; output: string }[];
  error?: string;
};

function normalizeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "";
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
  if (cleaned !== raw) process.env.DATABASE_URL = cleaned;
  return cleaned;
}

function prismaCli(): { cmd: string; prefix: string[] } {
  const local = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(local)) {
    return { cmd: process.execPath, prefix: [local] };
  }
  return { cmd: "npx", prefix: ["prisma"] };
}

function runPrisma(args: string[]): { ok: boolean; output: string } {
  const { cmd, prefix } = prismaCli();
  const result = spawnSync(cmd, [...prefix, ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    shell: false,
    timeout: 180_000,
  });
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim()
    .slice(0, 4000);
  if (result.error) {
    return { ok: false, output: `${result.error.message}\n${output}` };
  }
  return { ok: result.status === 0, output };
}

/**
 * Create/update MySQL tables + seed demo users.
 * Safe to call repeatedly (seed skips when users exist).
 */
export function ensureDatabase(): EnsureDbResult {
  const steps: EnsureDbResult["steps"] = [];
  const url = normalizeDatabaseUrl();

  if (!url.startsWith("mysql://")) {
    return {
      ok: false,
      steps,
      error: `DATABASE_URL must be mysql:// (got ${url ? "other scheme" : "empty"})`,
    };
  }

  // Prefer migrate; fall back to db push if migrations can't apply.
  let migrated = runPrisma(["migrate", "deploy"]);
  steps.push({ name: "migrate deploy", ok: migrated.ok, output: migrated.output });

  if (!migrated.ok) {
    const pushed = runPrisma(["db", "push", "--skip-generate", "--accept-data-loss"]);
    steps.push({ name: "db push", ok: pushed.ok, output: pushed.output });
    if (!pushed.ok) {
      return {
        ok: false,
        steps,
        error: "migrate and db push both failed — check Hostinger logs",
      };
    }
  }

  const seeded = runPrisma(["db", "seed"]);
  steps.push({ name: "db seed", ok: seeded.ok, output: seeded.output });

  // Seed failure is non-fatal if tables exist (user can register manually).
  return {
    ok: true,
    steps,
    error: seeded.ok ? undefined : "tables ready but seed failed",
  };
}

/** Absolute path helper for debugging cwd on Hostinger. */
export function ensureDbCwd() {
  return path.resolve(process.cwd());
}
