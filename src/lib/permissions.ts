import { Role } from "@prisma/client";

export type Permission =
  | "org:manage"
  | "users:manage"
  | "settings:manage"
  | "customers:read"
  | "customers:write"
  | "tickets:read"
  | "tickets:write"
  | "tickets:assign"
  | "tickets:escalate"
  | "sales:read"
  | "sales:write"
  | "payment:confirm"
  | "reports:read"
  | "automation:manage";

const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    "org:manage",
    "users:manage",
    "settings:manage",
    "customers:read",
    "customers:write",
    "tickets:read",
    "tickets:write",
    "tickets:assign",
    "tickets:escalate",
    "sales:read",
    "sales:write",
    "payment:confirm",
    "reports:read",
    "automation:manage",
  ],
  ORG_ADMIN: [
    "users:manage",
    "settings:manage",
    "customers:read",
    "customers:write",
    "tickets:read",
    "tickets:write",
    "tickets:assign",
    "tickets:escalate",
    "sales:read",
    "sales:write",
    "payment:confirm",
    "reports:read",
    "automation:manage",
  ],
  MANAGER: [
    "customers:read",
    "customers:write",
    "tickets:read",
    "tickets:write",
    "tickets:assign",
    "tickets:escalate",
    "sales:read",
    "sales:write",
    "payment:confirm",
    "reports:read",
  ],
  AGENT: [
    "customers:read",
    "customers:write",
    "tickets:read",
    "tickets:write",
    "tickets:assign",
    "sales:read",
    "sales:write",
    "payment:confirm",
    "reports:read",
  ],
  DEPARTMENT_USER: [
    "customers:read",
    "tickets:read",
    "tickets:write",
    "reports:read",
  ],
  VIEWER: [
    "customers:read",
    "tickets:read",
    "sales:read",
    "reports:read",
  ],
};

export function hasPermission(role: Role, permission: Permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function requirePermission(role: Role, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error("Forbidden");
  }
}
