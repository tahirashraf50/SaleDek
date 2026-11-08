"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearWebsiteLogo,
  updateWebsiteLogo,
  updateWebsiteSettings,
} from "@/server/actions/admin";
import {
  SEO_PAGE_META,
  type PageSeo,
  type SeoPageKey,
  type SeoPages,
} from "@/lib/website-seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type HeroStat = { value: string; label: string };

type Settings = {
  brandName: string;
  logoUrl: string | null;
  heroBadge: string;
  heroHeadline: string;
  heroSubtext: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroSecondaryLabel: string;
  heroSecondaryHref: string;
  heroStats: HeroStat[];
  featuresTitle: string;
  featuresSubtitle: string;
  sectionTitle: string;
  sectionBody: string;
  midTitle: string;
  midBody: string;
  analysisTitle: string;
  analysisBody: string;
  analysisBullets: string[];
  integrationsTitle: string;
  integrationsBody: string;
  integrations: string[];
  ctaTitle: string;
  ctaBody: string;
  contactEmail: string;
  contactPhone: string;
  footerBlurb: string;
  footerNote: string;
  copyrightName: string;
  seoPages: SeoPages;
};

function linesToList(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function WebsiteSettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState(initial);
  const [bulletsText, setBulletsText] = useState(initial.analysisBullets.join("\n"));
  const [integrationsText, setIntegrationsText] = useState(
    initial.integrations.join("\n")
  );

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setStat(i: number, key: keyof HeroStat, value: string) {
    setForm((prev) => {
      const next = [...prev.heroStats];
      next[i] = { ...next[i], [key]: value };
      return { ...prev, heroStats: next };
    });
  }

  function addStat() {
    setForm((prev) => ({
      ...prev,
      heroStats: [...prev.heroStats, { value: "", label: "" }].slice(0, 6),
    }));
  }

  function removeStat(i: number) {
    setForm((prev) => ({
      ...prev,
      heroStats: prev.heroStats.filter((_, idx) => idx !== i),
    }));
  }

  function setSeo(page: SeoPageKey, key: keyof PageSeo, value: string) {
    setForm((prev) => ({
      ...prev,
      seoPages: {
        ...prev.seoPages,
        [page]: { ...prev.seoPages[page], [key]: value },
      },
    }));
  }

  function onFile(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function saveLogo() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a logo image");
      return;
    }
    start(async () => {
      try {
        await updateWebsiteLogo(file);
        toast.success("Website logo updated");
        if (fileRef.current) fileRef.current.value = "";
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  function removeLogo() {
    start(async () => {
      try {
        await clearWebsiteLogo();
        toast.success("Logo removed");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function saveContent() {
    start(async () => {
      try {
        await updateWebsiteSettings({
          brandName: form.brandName,
          heroBadge: form.heroBadge,
          heroHeadline: form.heroHeadline,
          heroSubtext: form.heroSubtext,
          heroCtaLabel: form.heroCtaLabel,
          heroCtaHref: form.heroCtaHref,
          heroSecondaryLabel: form.heroSecondaryLabel,
          heroSecondaryHref: form.heroSecondaryHref,
          heroStats: form.heroStats,
          newsTickerItems: [],
          featuresTitle: form.featuresTitle,
          featuresSubtitle: form.featuresSubtitle,
          sectionTitle: form.sectionTitle,
          sectionBody: form.sectionBody,
          midTitle: form.midTitle,
          midBody: form.midBody,
          analysisTitle: form.analysisTitle,
          analysisBody: form.analysisBody,
          analysisBullets: linesToList(bulletsText),
          integrationsTitle: form.integrationsTitle,
          integrationsBody: form.integrationsBody,
          integrations: linesToList(integrationsText),
          ctaTitle: form.ctaTitle,
          ctaBody: form.ctaBody,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          footerBlurb: form.footerBlurb,
          footerNote: form.footerNote,
          copyrightName: form.copyrightName,
          seoPages: form.seoPages,
        });
        toast.success("Website content saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const logoSrc = preview || form.logoUrl;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-gradient-to-br from-teal-50/80 to-transparent px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Brand & logo</h2>
          <p className="text-[11px] text-slate-500">
            Shows in the public site header, hero, and footer
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <Label htmlFor="brandName">Brand name</Label>
            <Input
              id="brandName"
              value={form.brandName}
              onChange={(e) => set("brandName", e.target.value)}
              className="mt-1 max-w-md"
              disabled={pending}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoSrc}
                  alt="Logo"
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <ImagePlus className="h-6 w-6 text-slate-400" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                disabled={pending}
                onChange={(e) => onFile(e.target.files?.[0] || null)}
                className="max-w-md text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-teal-700 text-white hover:bg-teal-800"
                  disabled={pending}
                  onClick={saveLogo}
                >
                  Upload logo
                </Button>
                {form.logoUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-rose-700"
                    disabled={pending}
                    onClick={removeLogo}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Hero</h2>
          <p className="text-[11px] text-slate-500">
            Badge, headline, CTAs, and stat chips
          </p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <Label>Hero badge</Label>
            <Input
              value={form.heroBadge}
              onChange={(e) => set("heroBadge", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Hero headline</Label>
            <Input
              value={form.heroHeadline}
              onChange={(e) => set("heroHeadline", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Hero supporting text</Label>
            <Textarea
              value={form.heroSubtext}
              onChange={(e) => set("heroSubtext", e.target.value)}
              rows={3}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Primary CTA label</Label>
            <Input
              value={form.heroCtaLabel}
              onChange={(e) => set("heroCtaLabel", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Primary CTA link</Label>
            <Input
              value={form.heroCtaHref}
              onChange={(e) => set("heroCtaHref", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Secondary CTA label</Label>
            <Input
              value={form.heroSecondaryLabel}
              onChange={(e) => set("heroSecondaryLabel", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Secondary CTA link</Label>
            <Input
              value={form.heroSecondaryHref}
              onChange={(e) => set("heroSecondaryHref", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">Hero stats</p>
                <p className="text-[11px] text-slate-500">
                  Small cards under the hero buttons
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                disabled={pending || form.heroStats.length >= 6}
                onClick={addStat}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {form.heroStats.map((stat, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={stat.value}
                  onChange={(e) => setStat(i, "value", e.target.value)}
                  placeholder="15d"
                  disabled={pending}
                />
                <Input
                  value={stat.label}
                  onChange={(e) => setStat(i, "label", e.target.value)}
                  placeholder="Free demo"
                  disabled={pending}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-rose-700"
                  disabled={pending || form.heroStats.length <= 1}
                  onClick={() => removeStat(i)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Page sections</h2>
          <p className="text-[11px] text-slate-500">
            Features, reports, analysis, integrations, CTA
          </p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <Label>Features title</Label>
            <Input
              value={form.featuresTitle}
              onChange={(e) => set("featuresTitle", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Features subtitle</Label>
            <Input
              value={form.featuresSubtitle}
              onChange={(e) => set("featuresSubtitle", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Reports section title</Label>
            <Input
              value={form.sectionTitle}
              onChange={(e) => set("sectionTitle", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Reports section body</Label>
            <Textarea
              value={form.sectionBody}
              onChange={(e) => set("sectionBody", e.target.value)}
              rows={2}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Mid-page title</Label>
            <Input
              value={form.midTitle}
              onChange={(e) => set("midTitle", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Mid-page body</Label>
            <Textarea
              value={form.midBody}
              onChange={(e) => set("midBody", e.target.value)}
              rows={2}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Analysis title</Label>
            <Input
              value={form.analysisTitle}
              onChange={(e) => set("analysisTitle", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Analysis body</Label>
            <Textarea
              value={form.analysisBody}
              onChange={(e) => set("analysisBody", e.target.value)}
              rows={2}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Analysis bullets (one per line)</Label>
            <Textarea
              value={bulletsText}
              onChange={(e) => setBulletsText(e.target.value)}
              rows={4}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Integrations title</Label>
            <Input
              value={form.integrationsTitle}
              onChange={(e) => set("integrationsTitle", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Integrations body</Label>
            <Textarea
              value={form.integrationsBody}
              onChange={(e) => set("integrationsBody", e.target.value)}
              rows={2}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Integrations chips (one per line)</Label>
            <Textarea
              value={integrationsText}
              onChange={(e) => setIntegrationsText(e.target.value)}
              rows={4}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Bottom CTA title</Label>
            <Input
              value={form.ctaTitle}
              onChange={(e) => set("ctaTitle", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Bottom CTA body</Label>
            <Textarea
              value={form.ctaBody}
              onChange={(e) => set("ctaBody", e.target.value)}
              rows={2}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-gradient-to-br from-violet-50/80 to-transparent px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Page SEO</h2>
          <p className="text-[11px] text-slate-500">
            Title, meta description, and keywords for Home, About, Features, Pricing, and Contact
          </p>
        </div>
        <div className="space-y-5 p-5">
          {SEO_PAGE_META.map((page) => (
            <div
              key={page.key}
              className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{page.label}</p>
                <span className="font-mono text-[11px] text-slate-400">{page.path}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Meta title</Label>
                  <Input
                    value={form.seoPages[page.key].title}
                    onChange={(e) => setSeo(page.key, "title", e.target.value)}
                    className="mt-1"
                    disabled={pending}
                    maxLength={70}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Meta description</Label>
                  <Textarea
                    value={form.seoPages[page.key].description}
                    onChange={(e) => setSeo(page.key, "description", e.target.value)}
                    rows={2}
                    className="mt-1 resize-none"
                    disabled={pending}
                    maxLength={180}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Keywords (comma separated)</Label>
                  <Input
                    value={form.seoPages[page.key].keywords}
                    onChange={(e) => setSeo(page.key, "keywords", e.target.value)}
                    className="mt-1"
                    disabled={pending}
                    placeholder="CRM, sales, SaleDek"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Contact & footer</h2>
          <p className="text-[11px] text-slate-500">
            Email / phone shown on contact strip and footer
          </p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <Label>Contact email</Label>
            <Input
              value={form.contactEmail}
              onChange={(e) => set("contactEmail", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Contact phone</Label>
            <Input
              value={form.contactPhone}
              onChange={(e) => set("contactPhone", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Footer blurb</Label>
            <Textarea
              value={form.footerBlurb}
              onChange={(e) => set("footerBlurb", e.target.value)}
              rows={3}
              className="mt-1 resize-none"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Copyright name</Label>
            <Input
              value={form.copyrightName}
              onChange={(e) => set("copyrightName", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
          <div>
            <Label>Footer note</Label>
            <Input
              value={form.footerNote}
              onChange={(e) => set("footerNote", e.target.value)}
              className="mt-1"
              disabled={pending}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="h-10 bg-teal-700 px-5 text-white hover:bg-teal-800"
          disabled={pending}
          onClick={saveContent}
        >
          {pending ? "Saving…" : "Save website content"}
        </Button>
      </div>
    </div>
  );
}
