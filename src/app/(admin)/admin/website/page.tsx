import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import { requireSuperAdmin } from "@/lib/session";
import { getWebsiteSettings } from "@/lib/platform-website";
import { WebsiteSettingsForm } from "@/components/admin/website-settings-form";

export default async function AdminWebsiteSettingsPage() {
  await requireSuperAdmin();
  const settings = await getWebsiteSettings();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Marketing site
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-[28px] font-bold tracking-tight text-slate-900">
            <Globe className="h-7 w-7 text-teal-700" />
            Website settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Logo, hero, sections, contact & footer for{" "}
            <span className="font-medium text-slate-700">saledek.com</span>
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Open website
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <WebsiteSettingsForm
        initial={{
          brandName: settings.brandName,
          logoUrl: settings.logoUrl,
          heroBadge: settings.heroBadge,
          heroHeadline: settings.heroHeadline,
          heroSubtext: settings.heroSubtext,
          heroCtaLabel: settings.heroCtaLabel,
          heroCtaHref: settings.heroCtaHref,
          heroSecondaryLabel: settings.heroSecondaryLabel,
          heroSecondaryHref: settings.heroSecondaryHref,
          heroStats: settings.heroStats,
          featuresTitle: settings.featuresTitle,
          featuresSubtitle: settings.featuresSubtitle,
          sectionTitle: settings.sectionTitle,
          sectionBody: settings.sectionBody,
          midTitle: settings.midTitle,
          midBody: settings.midBody,
          analysisTitle: settings.analysisTitle,
          analysisBody: settings.analysisBody,
          analysisBullets: settings.analysisBullets,
          integrationsTitle: settings.integrationsTitle,
          integrationsBody: settings.integrationsBody,
          integrations: settings.integrations,
          ctaTitle: settings.ctaTitle,
          ctaBody: settings.ctaBody,
          contactEmail: settings.contactEmail,
          contactPhone: settings.contactPhone,
          footerBlurb: settings.footerBlurb,
          footerNote: settings.footerNote,
          copyrightName: settings.copyrightName,
        }}
      />
    </div>
  );
}
