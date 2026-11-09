import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { activateAccountByToken } from "@/lib/account-activation";
import { getWebsiteSettings } from "@/lib/platform-website";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ActivateAccountPage({ searchParams }: Props) {
  const site = await getWebsiteSettings();
  const { token } = await searchParams;
  const result = token
    ? await activateAccountByToken(token)
    : { ok: false as const, error: "Missing activation link." };

  return (
    <div className="site-hero-glow relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="site-anim-fade w-full max-w-md rounded-[1.75rem] border border-[var(--site-line)] bg-white/95 p-7 text-center shadow-[0_28px_60px_-36px_rgba(172,22,224,0.45)]">
        {result.ok ? (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--site-ink)]">
              Account activated
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
              {result.orgName
                ? `“${result.orgName}” is ready. `
                : "Your workspace is ready. "}
              Sign in with {result.email} to continue on {site.brandName}.
            </p>
            <Link
              href={`/login?activated=1&email=${encodeURIComponent(result.email)}`}
              className="site-btn-primary mt-6 inline-flex w-full justify-center"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <XCircle className="h-6 w-6" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--site-ink)]">
              Activation failed
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
              {result.error}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/check-email" className="site-btn-primary inline-flex w-full justify-center">
                Request a new link
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-[var(--site-purple)] hover:underline"
              >
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
