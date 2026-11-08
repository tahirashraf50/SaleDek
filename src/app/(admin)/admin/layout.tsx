import Link from "next/link";
import { Globe, LogOut } from "lucide-react";
import { requireSuperAdmin } from "@/lib/session";
import { logoutAction } from "@/server/actions/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-teal-800 text-sm font-bold text-white shadow-md shadow-slate-900/20">
              P
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Platform
              </p>
              <p className="text-sm font-bold tracking-tight text-slate-900">
                PulseCRM Admin
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 sm:block">
              {session.user.name}
            </div>
            <Link
              href="/"
              prefetch={false}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Globe className="h-3.5 w-3.5" />
              Website
            </Link>
            <form action={logoutAction}>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-white px-2.5 text-[11px]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl border-t border-slate-100 px-4 py-2.5 md:px-6">
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
