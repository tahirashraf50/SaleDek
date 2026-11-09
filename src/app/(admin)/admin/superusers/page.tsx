import { requireSuperAdmin } from "@/lib/session";
import { db } from "@/lib/db";
import { SuperUsersPanel } from "@/components/admin/superusers-panel";

export const dynamic = "force-dynamic";

export default async function AdminSuperUsersPage() {
  const session = await requireSuperAdmin();

  const users = await db.user.findMany({
    where: { role: "SUPER_ADMIN", organizationId: null },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <SuperUsersPanel
      currentUserId={session.user.id}
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        active: u.active,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
