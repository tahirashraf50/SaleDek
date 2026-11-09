import Link from "next/link";
import { Sora } from "next/font/google";
import { SiteNav } from "@/components/marketing/site-nav";
import { getWebsiteSettings } from "@/lib/platform-website";
import "./site.css";

const sans = Sora({
  subsets: ["latin"],
  variable: "--font-site-sans",
});

export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await getWebsiteSettings();

  return (
    <div className={`${sans.variable} site-root min-h-screen`}>
      <SiteNav brandName={site.brandName} logoUrl={site.logoUrl} />
      {children}
      <footer className="border-t border-[var(--site-line)] bg-[var(--site-soft)] text-[var(--site-ink)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.3fr_1fr_1fr] md:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              {site.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={site.logoUrl}
                  alt={site.brandName}
                  className="h-11 w-auto max-w-[200px] object-contain"
                />
              ) : (
                <>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--site-purple)] text-sm font-bold text-white">
                    {site.brandName.slice(0, 1)}
                  </span>
                  <p className="text-xl font-semibold text-[var(--site-ink)]">
                    {site.brandName}
                  </p>
                </>
              )}
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-black">
              {site.footerBlurb}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-purple)]">
              Product
            </p>
            <Link
              href="/about"
              className="block text-black/80 transition hover:text-[var(--site-purple)]"
            >
              About Us
            </Link>
            <Link
              href="/features"
              className="block text-black/80 transition hover:text-[var(--site-purple)]"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="block text-black/80 transition hover:text-[var(--site-purple)]"
            >
              Pricing
            </Link>
            <Link
              href="/register?plan=DEMO"
              className="block text-black/80 transition hover:text-[var(--site-purple)]"
            >
              Get Demo
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-purple)]">
              Contact
            </p>
            <Link
              href="/contact"
              className="block text-black/80 transition hover:text-[var(--site-purple)]"
            >
              Contact Us
            </Link>
            <a
              href={`mailto:${site.contactEmail}`}
              className="block text-black/80 transition hover:text-[var(--site-purple)]"
            >
              {site.contactEmail}
            </a>
            <a
              href={`tel:${site.contactPhone.replace(/[^\d+]/g, "") || site.contactPhone}`}
              className="block text-black/80 transition hover:text-[var(--site-purple)]"
            >
              {site.contactPhone}
            </a>
            <Link
              href="/login"
              className="block text-black/80 transition hover:text-[var(--site-purple)]"
            >
              Agent login
            </Link>
          </div>
        </div>
        <div className="border-t border-[var(--site-line)] bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-black/60 md:px-6">
            <span>
              © {new Date().getFullYear()} {site.copyrightName}
            </span>
            <span>{site.footerNote}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
