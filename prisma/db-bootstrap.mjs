#!/usr/bin/env node
/**
 * Create MySQL tables + seed. Prefer this path on Hostinger (prisma/ is always deployed).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function log(...args) {
  console.log(`[db-bootstrap] ${args.join(" ")}`);
}

function prismaInvocation(args) {
  const local = path.join(root, "node_modules", "prisma", "build", "index.js");
  if (fs.existsSync(local)) {
    return { cmd: process.execPath, args: [local, ...args] };
  }
  return { cmd: "npx", args: ["prisma", ...args] };
}

function runPrisma(args) {
  const { cmd, args: full } = prismaInvocation(args);
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

const raw = process.env.DATABASE_URL || "";
const url = raw.trim().replace(/^['"]|['"]$/g, "");
if (url !== raw) process.env.DATABASE_URL = url;

log("root =", root);
log(
  "DATABASE_URL =",
  url ? url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@") : "(empty)",
);

if (!url.startsWith("mysql://")) {
  log("ERROR: DATABASE_URL must start with mysql://");
  process.exit(1);
}

if (!fs.existsSync(path.join(root, "prisma", "schema.prisma"))) {
  log("ERROR: prisma/schema.prisma not found at", root);
  process.exit(1);
}

const migrated = runPrisma(["migrate", "deploy"]);
if (!migrated) {
  log("migrate deploy failed — trying db push");
  if (!runPrisma(["db", "push", "--skip-generate", "--accept-data-loss"])) {
    log("ERROR: migrate and db push both failed");
    process.exit(1);
  }
}

if (!runPrisma(["db", "seed"])) {
  log("WARN: seed failed");
  process.exit(0);
}

log("done");
process.exit(0);
