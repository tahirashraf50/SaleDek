import Link from "next/link";
import { ArrowLeft, CheckCircle2, Lock, Shield, Users } from "lucide-react";
import { loginAction } from "@/server/actions/auth";
import { getWebsiteSettings } from "@/lib/platform-website";

export const dynamic = "force-dynamic";

const HIGHLIGHTS = [
  {
    icon: Lock,
    title: "Secure agent access",
    body: "Sign in with your org email to open tickets, inbox, and pipelines.",
  },
  {
    icon: Users,
    title: "Built for your team",
    body: "Admins, finance, and agents each land in the right workspace.",
  },
  {
    icon: Shield,
    title: "Your data stays private",
    body: "Every login is scoped to your organization — nothing shared across tenants.",
  },
];

export default async function LoginPage() {
  const site = await getWebsiteSettings();

  return (
    <div className="site-root relative flex min-h-screen flex-col lg:flex-row">
      {/* Theme panel — left */}
      <aside className="site-dark-band relative hidden overflow-hidden lg:flex lg:w-[52%] xl:w-[56%] lg:flex-col lg:justify-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              "radial-gradient(rgba(201,255,112,0.4) 1.2px, transparent 1.2px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse at 45% 45%, black 15%, transparent 72%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 top-16 h-56 w-56 rounded-full bg-[rgba(172,22,224,0.35)] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-10 bottom-20 h-64 w-64 rounded-full bg-[rgba(201,255,112,0.2)] blur-3xl"
          aria-hidden
        />

        <div className="relative z-10 px-10 xl:px-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--site-lime)]">
            Workspace access
          </p>
          <h2 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-white xl:text-[2.65rem]">
            Your team&apos;s CRM, one secure login away
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-white/60 xl:text-base">
            Pick up where you left off — complaints, deals, and customer conversations
            in a single {site.brandName} workspace.
          </p>

          <ul className="mt-9 space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[var(--site-lime)]">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/55">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-10 inline-flex items-center gap-2 text-xs text-white/45">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--site-lime)]" />
            Trusted by service &amp; sales teams on {site.brandName}
          </p>
        </div>
      </aside>

      {/* Login — right */}
      <div className="site-hero-glow relative flex w-full flex-1 flex-col lg:w-[48%] xl:w-[44%]">
        <header className="relative z-10 flex items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            {site.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={site.logoUrl}
                alt=""
                className="h-9 w-auto rounded-md object-contain"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--site-purple)] text-sm font-bold text-white">
                {site.brandName.slice(0, 1)}
              </span>
            )}
            <span className="text-lg font-semibold tracking-tight text-[var(--site-ink)]">
              {site.brandName}
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--site-muted)] transition hover:text-[var(--site-purple)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Site
          </Link>
        </header>

        <main className="relative z-10 flex flex-1 items-start justify-center px-5 pb-10 pt-6 md:px-10 md:pt-10 lg:items-center lg:px-12 lg:pt-0">
          <div className="site-anim-fade w-full max-w-[400px] lg:-mt-8">
            <span className="site-pill">Agent login</span>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--site-ink)] md:text-4xl">
              Welcome back
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--site-muted)]">
              Sign in to your {site.brandName} workspace
            </p>

            <form action={loginAction} className="mt-7 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--site-muted)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue="admin@demo.com"
                  autoComplete="email"
                  className="h-12 w-full rounded-2xl border border-[var(--site-line)] bg-white px-4 text-sm text-[var(--site-ink)] outline-none transition focus:border-[var(--site-purple)] focus:ring-4 focus:ring-[rgba(172,22,224,0.12)]"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--site-muted)]"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  defaultValue="demo1234"
                  autoComplete="current-password"
                  className="h-12 w-full rounded-2xl border border-[var(--site-line)] bg-white px-4 text-sm text-[var(--site-ink)] outline-none transition focus:border-[var(--site-purple)] focus:ring-4 focus:ring-[rgba(172,22,224,0.12)]"
                />
              </div>
              <button type="submit" className="site-btn-primary w-full">
                Sign in
              </button>
            </form>

            <p className="mt-5 text-sm text-[var(--site-muted)]">
              New org?{" "}
              <Link
                href="/register"
                className="font-semibold text-[var(--site-purple)] hover:underline"
              >
                Register
              </Link>
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--site-muted)]">
              Demo · admin@demo.com · finance@demo.com · super@pulsecrm.com · pass demo1234
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
