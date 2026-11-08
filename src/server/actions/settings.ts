"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { Role, AutomationTrigger, OrgModuleKey } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePerm } from "@/lib/session";
import { Action, Condition } from "@/lib/automation";
import { ensureOrganizationModules } from "@/lib/org-defaults";
import { MODULE_DEFS, type ModuleKey } from "@/lib/module-defs";

export async function upsertOrganizationModule(input: {
  key: ModuleKey;
  enabled: boolean;
  departmentId: string | null;
}) {
  const session = await requirePerm("settings:manage");
  await ensureOrganizationModules(db, session.organizationId);

  if (!MODULE_DEFS.some((m) => m.key === input.key)) {
    throw new Error("Unknown module");
  }

  let departmentId = input.departmentId || null;
  if (departmentId) {
    const dept = await db.department.findFirst({
      where: { id: departmentId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!dept) throw new Error("Department not found");
  }

  const key = input.key as OrgModuleKey;

  const row = await db.organizationModule.upsert({
    where: {
      organizationId_key: {
        organizationId: session.organizationId,
        key,
      },
    },
    create: {
      organizationId: session.organizationId,
      key,
      enabled: input.enabled,
      departmentId,
    },
    update: {
      enabled: input.enabled,
      departmentId,
    },
  });

  // Avoid revalidatePath("/settings/departments") here — it fought with the
  // open page and produced a client refresh loop. Local UI state is enough.
  revalidatePath("/department");
  revalidatePath("/underwriting");
  revalidatePath("/finance");
  revalidatePath("/operations");
  revalidatePath("/sales/desk");
  revalidatePath("/technical");
  return row;
}

export async function createDepartment(name: string, description?: string) {
  const session = await requirePerm("settings:manage");
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Department name required");

  const clash = await db.department.findFirst({
    where: {
      organizationId: session.organizationId,
      name: { equals: trimmed, mode: "insensitive" },
    },
  });
  if (clash) throw new Error("A department with this name already exists");

  const dept = await db.department.create({
    data: {
      organizationId: session.organizationId,
      name: trimmed,
      description: description?.trim() || null,
    },
  });
  revalidatePath("/settings/departments");
  return dept;
}

export async function updateDepartment(
  departmentId: string,
  data: { name: string; description?: string; active?: boolean }
) {
  const session = await requirePerm("settings:manage");
  const existing = await db.department.findFirst({
    where: { id: departmentId, organizationId: session.organizationId },
  });
  if (!existing) throw new Error("Department not found");

  const trimmed = data.name.trim();
  if (!trimmed) throw new Error("Department name required");

  const clash = await db.department.findFirst({
    where: {
      organizationId: session.organizationId,
      name: { equals: trimmed, mode: "insensitive" },
      NOT: { id: departmentId },
    },
  });
  if (clash) throw new Error("A department with this name already exists");

  const dept = await db.department.update({
    where: { id: departmentId },
    data: {
      name: trimmed,
      description:
        data.description !== undefined
          ? data.description.trim() || null
          : undefined,
      ...(typeof data.active === "boolean" ? { active: data.active } : {}),
    },
  });
  revalidatePath("/settings/departments");
  revalidatePath("/department");
  revalidatePath("/settings/users");
  return dept;
}

export async function setDepartmentActive(
  departmentId: string,
  active: boolean
) {
  const session = await requirePerm("settings:manage");
  const existing = await db.department.findFirst({
    where: { id: departmentId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!existing) throw new Error("Department not found");
  await db.department.update({
    where: { id: departmentId },
    data: { active },
  });
  revalidatePath("/settings/departments");
  revalidatePath("/department");
  return { id: departmentId, active };
}

export async function deleteDepartment(departmentId: string) {
  const session = await requirePerm("settings:manage");
  const existing = await db.department.findFirst({
    where: { id: departmentId, organizationId: session.organizationId },
    include: {
      _count: { select: { users: true, tickets: true, teams: true } },
    },
  });
  if (!existing) throw new Error("Department not found");

  // Detach related records so delete is not blocked by FKs
  await db.$transaction([
    db.user.updateMany({
      where: {
        organizationId: session.organizationId,
        departmentId,
      },
      data: { departmentId: null },
    }),
    db.ticket.updateMany({
      where: {
        organizationId: session.organizationId,
        departmentId,
      },
      data: { departmentId: null },
    }),
    db.team.updateMany({
      where: {
        organizationId: session.organizationId,
        departmentId,
      },
      data: { departmentId: null },
    }),
    db.department.delete({ where: { id: departmentId } }),
  ]);

  revalidatePath("/settings/departments");
  revalidatePath("/department");
  revalidatePath("/settings/users");
  revalidatePath("/tickets");
  return {
    id: departmentId,
    detached: existing._count,
  };
}

export async function createTicketType(name: string, description?: string) {
  const session = await requirePerm("settings:manage");
  const type = await db.ticketType.create({
    data: { organizationId: session.organizationId, name, description },
  });
  revalidatePath("/settings/ticket-types");
  return type;
}

export async function setTicketTypeActive(typeId: string, active: boolean) {
  const session = await requirePerm("settings:manage");
  const existing = await db.ticketType.findFirst({
    where: { id: typeId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!existing) throw new Error("Ticket type not found");
  await db.ticketType.update({
    where: { id: typeId },
    data: { active },
  });
  revalidatePath("/settings/ticket-types");
  return { id: typeId, active };
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: Role;
  departmentId?: string;
}) {
  const session = await requirePerm("users:manage");
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await db.user.create({
    data: {
      organizationId: session.organizationId,
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      departmentId: data.departmentId || null,
    },
  });
  revalidatePath("/settings/users");
  return { id: user.id, email: user.email };
}

export async function setUserActive(userId: string, active: boolean) {
  const session = await requirePerm("users:manage");
  if (userId === session.user.id && !active) {
    throw new Error("You cannot disable your own login");
  }
  const existing = await db.user.findFirst({
    where: { id: userId, organizationId: session.organizationId },
    select: { id: true, role: true },
  });
  if (!existing) throw new Error("User not found");
  if (existing.role === "SUPER_ADMIN" && !active) {
    throw new Error("Cannot disable a super admin");
  }
  await db.user.update({
    where: { id: userId },
    data: { active },
  });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${userId}`);
  return { id: userId, active };
}

export async function updateUser(data: {
  userId: string;
  name: string;
  role: Role;
  departmentId?: string | null;
}) {
  const session = await requirePerm("users:manage");
  const existing = await db.user.findFirst({
    where: { id: data.userId, organizationId: session.organizationId },
    select: { id: true, role: true },
  });
  if (!existing) throw new Error("User not found");
  if (existing.role === "SUPER_ADMIN" && data.role !== "SUPER_ADMIN") {
    throw new Error("Cannot change super admin role");
  }
  await db.user.update({
    where: { id: data.userId },
    data: {
      name: data.name.trim(),
      role: data.role,
      departmentId: data.departmentId || null,
    },
  });
  revalidatePath("/settings/users");
  revalidatePath(`/settings/users/${data.userId}`);
  return { id: data.userId };
}

export async function createSlaPolicy(data: {
  name: string;
  priority?: string;
  ticketTypeId?: string;
  firstResponseMins: number;
  resolveMins: number;
}) {
  const session = await requirePerm("settings:manage");
  const policy = await db.slaPolicy.create({
    data: {
      organizationId: session.organizationId,
      name: data.name,
      priority: (data.priority as never) || null,
      ticketTypeId: data.ticketTypeId || null,
      firstResponseMins: data.firstResponseMins,
      resolveMins: data.resolveMins,
    },
  });
  revalidatePath("/settings/sla");
  return policy;
}

export async function setSlaPolicyActive(policyId: string, active: boolean) {
  const session = await requirePerm("settings:manage");
  const existing = await db.slaPolicy.findFirst({
    where: { id: policyId, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!existing) throw new Error("SLA policy not found");
  await db.slaPolicy.update({
    where: { id: policyId },
    data: { active },
  });
  revalidatePath("/settings/sla");
  return { id: policyId, active };
}

export async function createAutomationRule(data: {
  name: string;
  trigger: AutomationTrigger;
  conditions: Condition[];
  actions: Action[];
}) {
  const session = await requirePerm("automation:manage");
  const rule = await db.automationRule.create({
    data: {
      organizationId: session.organizationId,
      name: data.name,
      trigger: data.trigger,
      conditions: data.conditions as object[],
      actions: data.actions as object[],
      active: true,
    },
  });
  revalidatePath("/settings/automations");
  return rule;
}

export async function toggleAutomationRule(id: string, active: boolean) {
  const session = await requirePerm("automation:manage");
  await db.automationRule.updateMany({
    where: { id, organizationId: session.organizationId },
    data: { active },
  });
  revalidatePath("/settings/automations");
}

export async function createCustomField(data: {
  entity: string;
  name: string;
  key: string;
  fieldType: string;
  required?: boolean;
}) {
  const session = await requirePerm("settings:manage");
  const field = await db.customField.create({
    data: {
      organizationId: session.organizationId,
      entity: data.entity,
      name: data.name,
      key: data.key,
      fieldType: data.fieldType,
      required: data.required || false,
    },
  });
  revalidatePath("/settings/custom-fields");
  return field;
}

export async function createSavedView(data: {
  name: string;
  entity: string;
  filters: object;
  isShared?: boolean;
}) {
  const session = await requirePerm("tickets:read");
  const view = await db.savedView.create({
    data: {
      organizationId: session.organizationId,
      userId: session.user.id,
      name: data.name,
      entity: data.entity,
      filters: data.filters,
      isShared: data.isShared || false,
    },
  });
  revalidatePath("/tickets");
  return view;
}

export async function markNotificationsRead() {
  const session = await requirePerm("tickets:read");
  await db.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/dashboard");
}

export async function updateOrganizationCurrency(currency: string) {
  const session = await requirePerm("settings:manage");
  const { isSupportedCurrency } = await import("@/lib/currency");
  const code = String(currency || "").trim().toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new Error("Unsupported currency");
  }

  await db.organization.update({
    where: { id: session.organizationId },
    data: { currency: code },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings/workspace");
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
  revalidatePath("/sales");
  revalidatePath("/finance");
  return { currency: code };
}

export async function runSlaBreachJob() {
  const session = await requirePerm("settings:manage");
  const { markSlaBreaches } = await import("@/lib/sla");
  const { runAutomations } = await import("@/lib/automation");

  const count = await markSlaBreaches(session.organizationId);

  const breached = await db.slaTimer.findMany({
    where: {
      ticket: { organizationId: session.organizationId },
      OR: [{ firstBreached: true }, { resolveBreached: true }],
    },
    include: { ticket: true },
    take: 50,
  });

  for (const timer of breached) {
    await runAutomations({
      organizationId: session.organizationId,
      trigger: "SLA_BREACHED",
      ticketId: timer.ticketId,
      context: {
        ticketId: timer.ticketId,
        priority: timer.ticket.priority,
      },
    });
  }

  return { updated: count };
}
