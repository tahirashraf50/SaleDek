#!/usr/bin/env node
/**
 * Hostinger/shared hosting: ensure MySQL schema + demo seed.
 * Run via: node scripts/db-bootstrap.mjs  (npm start / /api/setup-db)
 * Never crashes the parent Next process when spawned as a child.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logFile = path.join(root, ".db-bootstrap.log");

function log(...args) {
  const line = `[db-bootstrap] ${args.join(" ")}`;
  console.log(line);
  try {
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* ignore */
  }
}

function prismaArgs(args) {
  const local = path.join(root, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(local)) {
    return { cmd: process.execPath, args: [local, ...args] };
  }
  return { cmd: "npx", args: ["prisma", ...args] };
}

function runPrisma(args) {
  const { cmd, args: full } = prismaArgs(args);
  log(`$ ${cmd} ${full.join(" ")}`);
  const result = spawnSync(cmd, full, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    shell: false,
  });
  if (result.stdout?.trim()) console.log(result.stdout.trimEnd());
  if (result.stderr?.trim()) console.error(result.stderr.trimEnd());
  if (result.error) {
    log("spawn error:", result.error.message);
    return false;
  }
  return result.status === 0;
}

try {
  fs.writeFileSync(logFile, "");
} catch {
  /* ignore */
}

const raw = process.env.DATABASE_URL || "";
const url = raw.trim().replace(/^['"]|['"]$/g, "");
if (url !== raw) {
  process.env.DATABASE_URL = url;
  log("stripped quotes from DATABASE_URL");
}
const redacted = url
  ? url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@")
  : "(empty)";

log("DATABASE_URL =", redacted);

if (!url.startsWith("mysql://")) {
  const scheme = (url.match(/^([a-zA-Z0-9+.-]+):\/\//) || [])[1] || "(none)";
  log(
    `ERROR: DATABASE_URL must start with mysql:// — current scheme="${scheme}".`,
  );
  process.exit(1);
}

const migrated = runPrisma(["migrate", "deploy"]);
if (!migrated) {
  log("migrate deploy failed — falling back to prisma db push");
  const pushed = runPrisma([
    "db",
    "push",
    "--skip-generate",
    "--accept-data-loss",
  ]);
  if (!pushed) {
    log("ERROR: both migrate and db push failed.");
    process.exit(1);
  }
}

const seeded = runPrisma(["db", "seed"]);
if (!seeded) {
  log("WARN: seed failed (tables may still be ready).");
  process.exit(0);
}

log("seed ok");
log("done");
process.exit(0);
