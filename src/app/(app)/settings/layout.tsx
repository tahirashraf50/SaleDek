import { requireOrgSession } from "@/lib/session";
import { SettingsNav } from "@/components/settings/settings-nav";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOrgSession();
  const isOrgAdmin = session.user.role === "ORG_ADMIN";

  return (
    <div className="flex min-h-full flex-col gap-5">
      <div className="-mx-5 -mt-5 border-b border-[#eee8f5] bg-white px-5 pb-4 pt-5 md:-mx-7 md:px-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Workspace
        </p>
        <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
          Settings
        </h2>
        <div className="mt-3">
          <SettingsNav isOrgAdmin={isOrgAdmin} />
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
