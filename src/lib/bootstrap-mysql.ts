import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

function splitSql(sql: string): string[] {
  return sql
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

async function findInitSql(): Promise<string | null> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const candidates = [
    path.join(process.cwd(), "src", "server", "mysql-init.sql"),
    path.join(
      process.cwd(),
      "prisma",
      "migrations",
      "20261108150000_mysql_init",
      "migration.sql",
    ),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

export type BootstrapMysqlResult = {
  ok: boolean;
  sqlFile: string | null;
  statements: number;
  applied: number;
  seeded: boolean;
  users: number | null;
  error?: string;
  logs: string[];
};

/** Apply bundled MySQL schema + minimal demo users (works without prisma/ on Hostinger). */
export async function bootstrapMysql(): Promise<BootstrapMysqlResult> {
  const fs = await import("node:fs");
  const logs: string[] = [];
  const sqlFile = await findInitSql();
  if (!sqlFile) {
    return {
      ok: false,
      sqlFile: null,
      statements: 0,
      applied: 0,
      seeded: false,
      users: null,
      error: "mysql-init.sql not found under src/server or prisma/migrations",
      logs,
    };
  }

  logs.push(`using ${sqlFile}`);
  const sql = fs.readFileSync(sqlFile, "utf8");
  const statements = splitSql(sql);
  let applied = 0;

  for (const statement of statements) {
    try {
      await db.$executeRawUnsafe(statement);
      applied += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already exists|Duplicate|ER_TABLE_EXISTS|ER_DUP_/i.test(message)) {
        logs.push(`skip: ${message.slice(0, 120)}`);
        continue;
      }
      return {
        ok: false,
        sqlFile,
        statements: statements.length,
        applied,
        seeded: false,
        users: null,
        error: message.slice(0, 500),
        logs,
      };
    }
  }

  logs.push(`applied ${applied}/${statements.length} statements`);

  // Additive patches for DBs created before newer columns existed.
  for (const patch of [
    "ALTER TABLE `PlatformInvoice` ADD COLUMN `paymentMethod` VARCHAR(191) NULL",
    "ALTER TABLE `PlatformInvoice` ADD COLUMN `paymentReference` VARCHAR(191) NULL",
  ]) {
    try {
      await db.$executeRawUnsafe(patch);
      logs.push(`patch: ${patch.slice(0, 80)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/Duplicate column|already exists/i.test(message)) continue;
      logs.push(`patch skip: ${message.slice(0, 120)}`);
    }
  }

  let seeded = false;
  let users: number | null = null;
  try {
    users = await db.user.count();
    if (users === 0) {
      const passwordHash = await bcrypt.hash("demo1234", 10);
      await db.user.create({
        data: {
          email: "super@pulsecrm.com",
          name: "Platform Super Admin",
          passwordHash,
          role: "SUPER_ADMIN",
          organizationId: null,
        },
      });

      const demo = await db.saaSPlan.upsert({
        where: { key: "DEMO" },
        create: {
          key: "DEMO",
          name: "Demo",
          priceMonthly: 0,
          description: "15-day free sandbox",
          features: ["Full CRM modules", "Up to 3 users"],
          maxUsers: 3,
          maxTicketsPerMonth: 200,
          trialDays: 15,
          sortOrder: 0,
        },
        update: {},
      });

      const org = await db.organization.create({
        data: {
          name: "Demo Telecom CRM",
          slug: "demo-telecom",
          status: "ACTIVE",
          planId: demo.id,
        },
      });

      await db.user.create({
        data: {
          organizationId: org.id,
          email: "admin@demo.com",
          name: "Ayesha Admin",
          passwordHash,
          role: "ORG_ADMIN",
        },
      });

      await db.platformWebsiteSettings.upsert({
        where: { id: "default" },
        create: { id: "default", brandName: "SaleDek", copyrightName: "SaleDek" },
        update: { brandName: "SaleDek", copyrightName: "SaleDek" },
      });

      seeded = true;
      users = await db.user.count();
      logs.push(`seeded ${users} users`);
    } else {
      logs.push(`seed skipped (${users} users exist)`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      sqlFile,
      statements: statements.length,
      applied,
      seeded,
      users,
      error: `schema ok but seed failed: ${message.slice(0, 400)}`,
      logs,
    };
  }

  return {
    ok: (users ?? 0) > 0,
    sqlFile,
    statements: statements.length,
    applied,
    seeded,
    users,
    logs,
  };
}
