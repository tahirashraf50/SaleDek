import { requireOrgSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getAppLookup } from "@/lib/lookup";
import { getAccessibleModuleNav } from "@/lib/modules";
import { roleLabel } from "@/lib/role-label";
import { setRequestCurrency } from "@/lib/org-currency-store";
import { AppShell } from "@/components/layout/app-shell";
import type { UserMenuProfile } from "@/components/layout/user-menu";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOrgSession();
  const isOrgAdmin = session.user.role === "ORG_ADMIN";

  const [lookup, unread, notifications, moduleNav, userRow, org] =
    await Promise.all([
      getAppLookup(session.organizationId),
      db.notification.count({
        where: { userId: session.user.id, read: false },
      }),
      db.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      getAccessibleModuleNav({
        organizationId: session.organizationId,
        user: {
          role: session.user.role,
          departmentId: session.user.departmentId,
        },
      }),
      db.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: { select: { name: true } },
        },
      }),
      db.organization.findUnique({
        where: { id: session.organizationId },
        select: {
          name: true,
          currency: true,
          status: true,
          createdAt: true,
          trialEndsAt: true,
          plan: { select: { name: true } },
          subscriptions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              startedAt: true,
              endsAt: true,
              status: true,
              plan: { select: { name: true } },
            },
          },
        },
      }),
    ]);

  const orgCurrency = org?.currency || "PKR";
  setRequestCurrency(orgCurrency);

  const sub = org?.subscriptions[0];
  const profile: UserMenuProfile = {
    id: userRow?.id || session.user.id,
    name: userRow?.name || session.user.name || "User",
    email: userRow?.email || session.user.email || "",
    role: userRow?.role || session.user.role,
    roleLabel: roleLabel(userRow?.role || session.user.role),
    departmentName: userRow?.department?.name || null,
    organizationName: org?.name || session.user.organizationName || "",
    canViewTenant: isOrgAdmin,
    canViewBilling: isOrgAdmin,
    planName: sub?.plan?.name || org?.plan?.name || null,
    tenantStatus: sub?.status || org?.status || null,
    startedAt: (sub?.startedAt || org?.createdAt)?.toISOString() || null,
    expiresAt: (sub?.endsAt || org?.trialEndsAt)?.toISOString() || null,
  };

  return (
    <AppShell
      orgName={session.user.organizationName}
      orgSlug={session.user.organizationSlug}
      userName={session.user.name}
      userRole={session.user.role}
      unread={unread}
      notifications={notifications.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }))}
      lookup={lookup}
      moduleNav={moduleNav}
      profile={profile}
      currency={orgCurrency}
    >
      {children}
    </AppShell>
  );
}
