import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChartColumn,
  Mail,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOrgSession } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";
import { UserLoginToggle } from "@/components/settings/user-login-toggle";
import { UserProfileForm } from "@/components/settings/user-profile-form";

type Props = {
  params: Promise<{ id: string }>;
};

function roleLabel(role: string) {
  return role
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default async function UserManagePage({ params }: Props) {
  const session = await requireOrgSession();
  const { id } = await params;

  const [user, departments] = await Promise.all([
    db.user.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        department: { select: { id: true, name: true } },
        _count: {
          select: {
            assignedTickets: true,
            createdOrders: true,
            assignedConversations: true,
          },
        },
      },
    }),
    db.department.findMany({
      where: { organizationId: session.organizationId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!user) notFound();

  const isSelf = session.user.id === user.id;
  const canShowReport = ["AGENT", "MANAGER", "DEPARTMENT_USER"].includes(
    user.role
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/settings/users"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#ac16e0]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Users
        </Link>
        {canShowReport ? (
          <Link
            href={`/reports/agents/${user.id}?range=30d`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#8b10b8] hover:underline"
          >
            <ChartColumn className="h-3.5 w-3.5" />
            Report
          </Link>
        ) : null}
      </div>

      <section className="rounded-2xl border border-[#eee8f5] bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ac16e0] to-[#8b10b8] text-sm font-bold text-white">
            {initials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="truncate text-lg font-semibold text-slate-900">
                {user.name}
              </h1>
              {isSelf ? (
                <span className="rounded-md bg-[rgba(172,22,224,0.1)] px-1.5 py-0.5 text-[10px] font-semibold text-[#ac16e0]">
                  You
                </span>
              ) : null}
              <span className="rounded-md bg-[#f6f3fb] px-1.5 py-0.5 text-[10px] font-semibold text-[#8b10b8]">
                {roleLabel(user.role)}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3 text-slate-400" />
                {user.email}
              </span>
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3 text-slate-400" />
                {user.department?.name || "No department"}
              </span>
              <span>Joined {formatDate(user.createdAt)}</span>
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              {user._count.assignedTickets} tickets · {user._count.createdOrders}{" "}
              orders · {user._count.assignedConversations} inbox
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={cn(
                "text-[11px] font-semibold",
                user.active ? "text-emerald-600" : "text-slate-400"
              )}
            >
              {user.active ? "Login on" : "Login off"}
            </span>
            <UserLoginToggle
              userId={user.id}
              active={user.active}
              disabled={isSelf}
              size="sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#eee8f5] bg-white p-4 md:p-5">
        <h2 className="text-sm font-semibold text-slate-900">Edit profile</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Name, role, and department
        </p>
        <div className="mt-4">
          <UserProfileForm
            user={{
              id: user.id,
              name: user.name,
              role: user.role,
              departmentId: user.departmentId,
            }}
            departments={departments}
          />
        </div>
      </section>
    </div>
  );
}
