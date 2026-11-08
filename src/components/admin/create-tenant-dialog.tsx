"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTenant } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPlatformCurrency } from "@/lib/utils";

type Plan = {
  key: string;
  name: string;
  priceMonthly: number;
};

export function CreateTenantDialog({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [planKey, setPlanKey] = useState(plans[0]?.key || "STARTER");
  const [status, setStatus] = useState<"ACTIVE" | "TRIAL">("ACTIVE");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  function reset() {
    setOrgName("");
    setSlug("");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    setPlanKey(plans[0]?.key || "STARTER");
    setStatus("ACTIVE");
    setLogo(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onLogoChange(file: File | null) {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogo(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function submit() {
    start(async () => {
      try {
        const res = await createTenant({
          orgName,
          slug: slug || undefined,
          adminName,
          adminEmail,
          adminPassword,
          planKey,
          status,
          logo,
        });
        toast.success(`Tenant “${res.name}” created`);
        setOpen(false);
        reset();
        router.push(`/admin/orgs/${res.id}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Create failed");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        className="h-9 gap-1.5 bg-teal-700 text-white hover:bg-teal-800"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Add company
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add tenant company</DialogTitle>
            <DialogDescription>
              Manually create an organization with logo + org-admin login.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div>
              <Label>Company logo</Label>
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={pending}
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-teal-400 hover:bg-teal-50/40"
                >
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <Input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                    className="text-xs"
                    disabled={pending}
                    onChange={(e) =>
                      onLogoChange(e.target.files?.[0] || null)
                    }
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Shown on customer portal · PNG/JPG/WEBP · max 2MB
                  </p>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="tenant-org">Company name</Label>
              <Input
                id="tenant-org"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Support Co"
                className="mt-1"
                disabled={pending}
              />
            </div>
            <div>
              <Label htmlFor="tenant-slug">Slug (optional)</Label>
              <Input
                id="tenant-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto from company name"
                className="mt-1"
                disabled={pending}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Used for shop / portal URLs
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="tenant-plan">Plan</Label>
                <Select
                  id="tenant-plan"
                  value={planKey}
                  onChange={(e) => setPlanKey(e.target.value)}
                  className="mt-1"
                  disabled={pending}
                >
                  {plans.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} — {formatPlatformCurrency(p.priceMonthly)}/mo
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="tenant-status">Status</Label>
                <Select
                  id="tenant-status"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "ACTIVE" | "TRIAL")
                  }
                  className="mt-1"
                  disabled={pending}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="TRIAL">Trial (14 days)</option>
                </Select>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Org admin
              </p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="tenant-admin-name">Name</Label>
                  <Input
                    id="tenant-admin-name"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="mt-1 bg-white"
                    disabled={pending}
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-admin-email">Email</Label>
                  <Input
                    id="tenant-admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="mt-1 bg-white"
                    disabled={pending}
                  />
                </div>
                <div>
                  <Label htmlFor="tenant-admin-pass">Password</Label>
                  <Input
                    id="tenant-admin-pass"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    minLength={6}
                    className="mt-1 bg-white"
                    disabled={pending}
                  />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                pending ||
                !orgName.trim() ||
                !adminName.trim() ||
                !adminEmail.trim() ||
                adminPassword.length < 6
              }
              className="bg-teal-700 text-white hover:bg-teal-800"
              onClick={submit}
            >
              {pending ? "Creating…" : "Create company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
