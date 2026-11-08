import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaVersion: string | undefined;
};

/** Bump when schema models change so hot-reload doesn't keep a stale client. */
const PRISMA_CLIENT_VERSION = "order-item-form-values-v1";

/** Hostinger env UI sometimes wraps values in quotes — strip them. */
function normalizeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, "");
  if (cleaned !== raw) {
    process.env.DATABASE_URL = cleaned;
  }
}

function createClient() {
  normalizeDatabaseUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db =
  globalForPrisma.prisma && globalForPrisma.prismaVersion === PRISMA_CLIENT_VERSION
    ? globalForPrisma.prisma
    : createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION;
}
