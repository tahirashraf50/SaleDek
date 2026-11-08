import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { orgLogoPublicUrl } from "@/lib/org-logo";
import { PortalClient } from "@/components/portal/portal-client";

export const dynamic = "force-dynamic";

const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || "PulseCRM";

type Props = { params: Promise<{ orgSlug: string }> };

export default async function PortalPage({ params }: Props) {
  const { orgSlug } = await params;
  const org = await db.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) notFound();

  const logoUrl = org.logoPath ? orgLogoPublicUrl(org.slug) : null;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-100 via-[#f6f3fb] to-slate-200">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={`${org.name} logo`}
                className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-sm"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ac16e0] text-sm font-bold text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]">
                {org.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-slate-900">
                {org.name}
              </div>
              <div className="text-xs text-slate-500">
                Customer self-service portal
              </div>
            </div>
          </div>
          <Link
            href="/login"
            className="shrink-0 text-sm text-[#8b10b8] hover:underline"
          >
            Agent login
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <PortalClient orgSlug={org.slug} orgName={org.name} />
      </main>

      <footer className="border-t border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-slate-500">
          <span className="font-medium text-slate-600">{org.name}</span>
          <span>
            Powered by{" "}
            <Link
              href="/"
              className="font-semibold text-[#8b10b8] hover:underline"
            >
              {PLATFORM_NAME}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
