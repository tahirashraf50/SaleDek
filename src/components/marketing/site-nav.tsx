"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "Home", exact: true },
  { href: "/about", label: "About Us" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function SiteNav({
  brandName,
  logoUrl,
}: {
  brandName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-[var(--site-line)] bg-white/95 shadow-[0_10px_30px_-24px_rgba(31,31,31,0.35)] backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--site-ink)]"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--site-purple)] text-sm font-bold text-white">
              {brandName.slice(0, 1)}
            </span>
          )}
          {brandName}
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-[var(--site-muted)] lg:flex">
          {links.map((l) => {
            const active = l.exact
              ? pathname === l.href
              : pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-2 transition ${
                  active
                    ? "bg-[var(--site-soft)] text-[var(--site-purple)]"
                    : "hover:text-[var(--site-ink)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="rounded-full px-3 py-2 text-sm font-medium text-[var(--site-muted)] hover:text-[var(--site-ink)]"
          >
            Login
          </Link>
          <Link href="/register?plan=DEMO" className="site-btn-primary !py-2.5 !text-sm">
            Get Demo
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--site-line)] text-[var(--site-ink)] lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--site-line)] bg-white px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--site-ink)] hover:bg-[var(--site-soft)]"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--site-muted)]"
            >
              Login
            </Link>
            <Link href="/register?plan=DEMO" className="site-btn-primary mt-2 text-center">
              Get Demo
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
