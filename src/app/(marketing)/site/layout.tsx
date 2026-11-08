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
      <footer className="border-t border-[var(--site-line)] bg-[#0f0a14] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.3fr_1fr_1fr] md:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              {site.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={site.logoUrl}
                  alt=""
                  className="h-9 w-auto rounded-md bg-white/10 object-contain p-1"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--site-purple)] text-sm font-bold">
                  {site.brandName.slice(0, 1)}
                </span>
              )}
              <p className="text-xl font-semibold">{site.brandName}</p>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
              {site.footerBlurb}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-lime)]">
              Product
            </p>
            <Link href="/site/about" className="block text-white/70 hover:text-white">
              About Us
            </Link>
            <Link href="/site/features" className="block text-white/70 hover:text-white">
              Features
            </Link>
            <Link href="/site/pricing" className="block text-white/70 hover:text-white">
              Pricing
            </Link>
            <Link href="/register?plan=DEMO" className="block text-white/70 hover:text-white">
              Get Demo
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--site-lime)]">
              Contact
            </p>
            <Link href="/site/contact" className="block text-white/70 hover:text-white">
              Contact Us
            </Link>
            <a
              href={`mailto:${site.contactEmail}`}
              className="block text-white/70 hover:text-white"
            >
              {site.contactEmail}
            </a>
            <a
              href={`tel:${site.contactPhone.replace(/[^\d+]/g, "") || site.contactPhone}`}
              className="block text-white/70 hover:text-white"
            >
              {site.contactPhone}
            </a>
            <Link href="/login" className="block text-white/70 hover:text-white">
              Agent login
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-white/40 md:px-6">
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
