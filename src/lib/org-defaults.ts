import {
  DealStageKey,
  OrgModuleKey,
  TicketPriority,
  TicketStageKey,
  PrismaClient,
} from "@prisma/client";

const ALL_MODULE_KEYS: OrgModuleKey[] = [
  "UNDERWRITING",
  "FINANCE",
  "OPERATIONS",
  "SALES",
  "TECHNICAL",
];

/** Default department name that owns each module when seeding. */
const MODULE_DEFAULT_DEPT: Partial<Record<OrgModuleKey, string>> = {
  UNDERWRITING: "Underwriting",
  FINANCE: "Finance",
  OPERATIONS: "Operations",
  SALES: "Sales",
  TECHNICAL: "Technical",
};

const ticketStages: { key: TicketStageKey; name: string; position: number; isTerminal?: boolean; color: string }[] = [
  { key: "NEW", name: "New", position: 0, color: "#64748b" },
  { key: "TRIAGED", name: "Triaged", position: 1, color: "#0ea5e9" },
  { key: "FORWARDED", name: "Forwarded", position: 2, color: "#8b5cf6" },
  { key: "IN_PROGRESS", name: "In Progress", position: 3, color: "#f59e0b" },
  { key: "WAITING_CUSTOMER", name: "Waiting on Customer", position: 4, color: "#94a3b8" },
  { key: "ESCALATED", name: "Escalated", position: 5, color: "#ef4444" },
  { key: "RESOLVED", name: "Resolved", position: 6, isTerminal: true, color: "#10b981" },
  { key: "CLOSED", name: "Closed", position: 7, isTerminal: true, color: "#334155" },
  { key: "REOPENED", name: "Reopened", position: 8, color: "#f97316" },
];

const dealStages: { key: DealStageKey; name: string; position: number; isWon?: boolean; isLost?: boolean; color: string }[] = [
  { key: "LEAD", name: "Lead", position: 0, color: "#64748b" },
  { key: "QUALIFIED", name: "Qualified", position: 1, color: "#0ea5e9" },
  { key: "PROPOSAL", name: "Proposal", position: 2, color: "#8b5cf6" },
  { key: "NEGOTIATION", name: "Negotiation", position: 3, color: "#f59e0b" },
  { key: "WON", name: "Won", position: 4, isWon: true, color: "#10b981" },
  { key: "LOST", name: "Lost", position: 5, isLost: true, color: "#ef4444" },
];

const ticketTypes = ["Billing", "Product", "Service", "Delivery", "Other"];

const departments = [
  "Customer Support",
  "Finance",
  "Technical",
  "Sales",
  "Operations",
  "Underwriting",
];

/** Ensure Underwriting department exists (for orgs created before this dept was added). */
export async function ensureUnderwritingDepartment(
  db: PrismaClient,
  organizationId: string
) {
  const existing = await db.department.findFirst({
    where: { organizationId, name: "Underwriting" },
  });
  if (existing) return existing;
  return db.department.create({
    data: { organizationId, name: "Underwriting", active: true },
  });
}

/** Ensure all 5 org modules exist; wire default depts when available. */
export async function ensureOrganizationModules(
  db: PrismaClient,
  organizationId: string
) {
  const depts = await db.department.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  const byName = new Map(depts.map((d) => [d.name, d.id]));

  const existing = await db.organizationModule.findMany({
    where: { organizationId },
    select: { key: true },
  });
  const have = new Set(existing.map((e) => e.key));

  for (const key of ALL_MODULE_KEYS) {
    if (have.has(key)) continue;
    const deptName = MODULE_DEFAULT_DEPT[key];
    const departmentId = deptName ? byName.get(deptName) || null : null;
    await db.organizationModule.create({
      data: {
        organizationId,
        key,
        // Underwriting on by default when dept exists (matches current product)
        enabled: key === "UNDERWRITING" && Boolean(departmentId),
        departmentId,
      },
    });
  }

  return db.organizationModule.findMany({
    where: { organizationId },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { key: "asc" },
  });
}

export async function seedOrganizationDefaults(
  db: PrismaClient,
  organizationId: string
) {
  await db.ticketStage.createMany({
    data: ticketStages.map((s) => ({
      organizationId,
      key: s.key,
      name: s.name,
      position: s.position,
      isTerminal: s.isTerminal ?? false,
      color: s.color,
    })),
  });

  await db.dealStage.createMany({
    data: dealStages.map((s) => ({
      organizationId,
      key: s.key,
      name: s.name,
      position: s.position,
      isWon: s.isWon ?? false,
      isLost: s.isLost ?? false,
      color: s.color,
    })),
  });

  await db.ticketType.createMany({
    data: ticketTypes.map((name) => ({ organizationId, name })),
  });

  await db.department.createMany({
    data: departments.map((name) => ({ organizationId, name })),
  });

  await ensureOrganizationModules(db, organizationId);

  await db.slaPolicy.createMany({
    data: [
      {
        organizationId,
        name: "Urgent — 1h / 8h",
        priority: TicketPriority.URGENT,
        firstResponseMins: 60,
        resolveMins: 480,
      },
      {
        organizationId,
        name: "High — 4h / 24h",
        priority: TicketPriority.HIGH,
        firstResponseMins: 240,
        resolveMins: 1440,
      },
      {
        organizationId,
        name: "Medium — 8h / 48h",
        priority: TicketPriority.MEDIUM,
        firstResponseMins: 480,
        resolveMins: 2880,
      },
      {
        organizationId,
        name: "Low — 24h / 72h",
        priority: TicketPriority.LOW,
        firstResponseMins: 1440,
        resolveMins: 4320,
      },
    ],
  });
}
