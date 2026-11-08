import type { Role } from "@prisma/client";

const LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Platform admin",
  ORG_ADMIN: "Organization admin",
  MANAGER: "Manager",
  AGENT: "Agent",
  DEPARTMENT_USER: "Department user",
  VIEWER: "Viewer",
};

export function roleLabel(role: Role | string | null | undefined) {
  if (!role) return "—";
  return LABELS[role as Role] || String(role).replace(/_/g, " ");
}
