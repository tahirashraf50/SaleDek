import { Mail, Phone } from "lucide-react";
import { getWebsiteSettings } from "@/lib/platform-website";

export default async function ContactPage() {
  const site = await getWebsiteSettings();
  const phoneTel = site.contactPhone.replace(/[^\d+]/g, "") || site.contactPhone;

  return (
    <div className="site-hero-glow pt-28 pb-20 md:pt-32 md:pb-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <span className="site-pill">Contact</span>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--site-ink)] md:text-6xl">
          Ready to see a personalized demo?
        </h1>
        <p className="mt-4 max-w-xl text-[var(--site-muted)]">
          Mail us or call — we will walk you through the CRM workspace for your team.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <a
              href={`mailto:${site.contactEmail}`}
              className="flex items-center gap-4 rounded-2xl border border-[var(--site-line)] bg-white p-5"
            >
              <span className="site-icon-blob">
                <Mail className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-[var(--site-ink)]">Mail us</p>
                <p className="text-sm text-[var(--site-muted)]">{site.contactEmail}</p>
              </div>
            </a>
            <a
              href={`tel:${phoneTel}`}
              className="flex items-center gap-4 rounded-2xl border border-[var(--site-line)] bg-white p-5"
            >
              <span className="site-icon-blob">
                <Phone className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-[var(--site-ink)]">Call us</p>
                <p className="text-sm text-[var(--site-muted)]">{site.contactPhone}</p>
              </div>
            </a>
          </div>

          <form className="rounded-[1.75rem] border border-[var(--site-line)] bg-white p-6 shadow-[0_24px_50px_-36px_rgba(31,31,31,0.35)] md:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-[var(--site-ink)]">First Name *</span>
                <input
                  required
                  name="firstName"
                  className="mt-1.5 w-full rounded-xl border border-[var(--site-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--site-purple)]"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-[var(--site-ink)]">Last Name</span>
                <input
                  name="lastName"
                  className="mt-1.5 w-full rounded-xl border border-[var(--site-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--site-purple)]"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-[var(--site-ink)]">Email *</span>
                <input
                  required
                  type="email"
                  name="email"
                  className="mt-1.5 w-full rounded-xl border border-[var(--site-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--site-purple)]"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-[var(--site-ink)]">Number *</span>
                <input
                  required
                  name="phone"
                  className="mt-1.5 w-full rounded-xl border border-[var(--site-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--site-purple)]"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-[var(--site-ink)]">Textarea *</span>
                <textarea
                  required
                  name="message"
                  rows={4}
                  className="mt-1.5 w-full resize-none rounded-xl border border-[var(--site-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--site-purple)]"
                />
              </label>
            </div>
            <button type="submit" className="site-btn-primary mt-5 w-full sm:w-auto">
              Request a Demo
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
