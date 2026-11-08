"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { updateOrganizationLogo } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orgLogoPublicUrl } from "@/lib/org-logo";

export function OrgLogoForm({
  orgId,
  orgSlug,
  hasLogo,
  logoVersion,
}: {
  orgId: string;
  orgSlug: string;
  hasLogo: boolean;
  logoVersion?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  function onFile(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function save() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a logo image");
      return;
    }
    start(async () => {
      try {
        await updateOrganizationLogo(orgId, file);
        toast.success("Logo updated — visible on portal");
        if (fileRef.current) fileRef.current.value = "";
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  const currentUrl = hasLogo
    ? `${orgLogoPublicUrl(orgSlug)}${logoVersion ? `?v=${encodeURIComponent(logoVersion)}` : ""}`
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {preview || currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview || currentUrl || ""}
              alt="Logo"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <ImagePlus className="h-5 w-5 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`logo-${orgId}`}>Upload logo</Label>
          <Input
            id={`logo-${orgId}`}
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="mt-1 text-xs"
            disabled={pending}
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Shows on /portal/{orgSlug}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        className="bg-teal-700 text-white hover:bg-teal-800"
        disabled={pending}
        onClick={save}
      >
        {pending ? "Saving…" : "Save logo"}
      </Button>
    </div>
  );
}
