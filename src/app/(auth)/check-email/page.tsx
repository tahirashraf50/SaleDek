import Link from "next/link";
import { Mail } from "lucide-react";
import { ResendActivationForm } from "@/components/auth/resend-activation-form";
import { getWebsiteSettings } from "@/lib/platform-website";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ email?: string }> };

export default async function CheckEmailPage({ searchParams }: Props) {
  const site = await getWebsiteSettings();
  const { email } = await searchParams;
  const address = (email || "").trim().toLowerCase();

  return (
    <div className="site-hero-glow relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="site-anim-fade w-full max-w-md rounded-[1.75rem] border border-[var(--site-line)] bg-white/95 p-7 text-center shadow-[0_28px_60px_-36px_rgba(172,22,224,0.45)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(172,22,224,0.1)] text-[var(--site-purple)]">
          <Mail className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--site-ink)]">
          Check your work email
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--site-muted)]">
          We sent an activation link
          {address ? (
            <>
              {" "}
              to{" "}
              <span className="font-medium text-[var(--site-ink)]">{address}</span>
            </>
          ) : null}
          . Open it to enable your {site.brandName} workspace, then sign in.
        </p>

        <div className="mt-6 space-y-3">
          <Link href="/login" className="site-btn-primary inline-flex w-full justify-center">
            Go to login
          </Link>
          {address ? <ResendActivationForm email={address} /> : null}
        </div>

        <p className="mt-5 text-[11px] text-[var(--site-muted)]">
          Link expires in 48 hours. Check spam if you do not see it.
        </p>
      </div>
    </div>
  );
}
