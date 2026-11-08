#!/usr/bin/env node
/**
 * Hostinger/shared hosting: ensure MySQL schema + demo seed before next start.
 * Never crashes the process — app can still serve marketing if DB is down.
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

function run(bin, args) {
  log(`$ ${bin} ${args.join(" ")}`);
  const result = spawnSync(bin, args, {
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
    `ERROR: DATABASE_URL must start with mysql:// — current scheme="${scheme}". Delete old postgresql:// value on Hostinger and set MySQL URL.`,
  );
  process.exit(0);
}

const migrated = run("npx", ["prisma", "migrate", "deploy"]);
if (!migrated) {
  log("migrate deploy failed — falling back to prisma db push");
  const pushed = run("npx", ["prisma", "db", "push", "--skip-generate"]);
  if (!pushed) {
    log("ERROR: both migrate and db push failed. Check MySQL host/user/pass.");
    process.exit(0);
  }
}

const seeded = run("npx", ["prisma", "db", "seed"]);
if (!seeded) {
  log("WARN: seed failed (app will still start).");
} else {
  log("seed ok");
}

log("done");
process.exit(0);
