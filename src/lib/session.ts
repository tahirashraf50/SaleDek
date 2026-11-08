import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hasPermission, Permission } from "@/lib/permissions";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.organizationId && session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/inbox");
  }
  return session;
}

export async function requireOrgSession() {
  const session = await requireSession();
  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }
  if (!session.user.organizationId) {
    throw new Error("Organization required");
  }
  if (session.user.organizationStatus === "SUSPENDED") {
    redirect("/suspended");
  }
  return {
    ...session,
    organizationId: session.user.organizationId,
  };
}

export async function requirePerm(permission: Permission) {
  const session = await requireOrgSession();
  if (!hasPermission(session.user.role, permission)) {
    throw new Error("Forbidden");
  }
  return session;
}
