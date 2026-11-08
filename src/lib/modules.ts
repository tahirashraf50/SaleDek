import { OrgModuleKey, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ensureOrganizationModules } from "@/lib/org-defaults";
import { MODULE_DEFS, moduleDef, type ModuleKey } from "@/lib/module-defs";
import type { requireOrgSession } from "@/lib/session";

export { MODULE_DEFS, moduleDef };
export type { ModuleDef, ModuleKey } from "@/lib/module-defs";

type SessionLike = Awaited<ReturnType<typeof requireOrgSession>>;

const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ORG_ADMIN", "MANAGER"];

export function isModuleAdminRole(role: Role | string | null | undefined) {
  return Boolean(role && ADMIN_ROLES.includes(role as Role));
}

export async function getOrgModules(organizationId: string) {
  await ensureOrganizationModules(db, organizationId);
  return db.organizationModule.findMany({
    where: { organizationId },
    include: { department: { select: { id: true, name: true } } },
    orderBy: { key: "asc" },
  });
}

export async function getOrgModule(
  organizationId: string,
  key: OrgModuleKey
) {
  await ensureOrganizationModules(db, organizationId);
  return db.organizationModule.findUnique({
    where: {
      organizationId_key: { organizationId, key },
    },
    include: { department: { select: { id: true, name: true } } },
  });
}

export function userCanAccessModule(
  session: {
    user: { role: Role | string; departmentId?: string | null };
  },
  mod: { enabled: boolean; departmentId: string | null } | null | undefined
) {
  if (!mod?.enabled) return false;
  if (isModuleAdminRole(session.user.role)) return true;
  if (!mod.departmentId) return false;
  return session.user.departmentId === mod.departmentId;
}

export async function assertModuleAccess(
  session: SessionLike,
  key: OrgModuleKey
) {
  const mod = await getOrgModule(session.organizationId, key);
  if (!mod?.enabled) {
    redirect("/department");
  }
  if (!userCanAccessModule(session, mod)) {
    redirect("/department");
  }
  return mod;
}

/** For server actions — throws instead of redirect. */
export async function requireModuleAccess(
  session: SessionLike,
  key: OrgModuleKey
) {
  const mod = await getOrgModule(session.organizationId, key);
  if (!mod?.enabled) throw new Error("Module is disabled");
  if (!userCanAccessModule(session, mod)) {
    throw new Error("You do not have access to this module");
  }
  return mod;
}

export async function isModuleEnabled(
  organizationId: string,
  key: OrgModuleKey
) {
  const mod = await getOrgModule(organizationId, key);
  return Boolean(mod?.enabled);
}

/** Nav items the current user may see for enabled modules they can access. */
export async function getAccessibleModuleNav(session: {
  organizationId: string;
  user: { role: Role | string; departmentId?: string | null };
}) {
  const modules = await getOrgModules(session.organizationId);
  return MODULE_DEFS.filter((def) => {
    const row = modules.find((m) => m.key === def.key);
    return userCanAccessModule(session, row);
  }).map((def) => ({
    href: def.href,
    label: def.label,
    key: def.key,
  }));
}
