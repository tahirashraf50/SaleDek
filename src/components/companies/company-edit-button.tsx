"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCompany } from "@/server/actions/customers";

export type CompanyEditValues = {
  id: string;
  name: string;
  ntn: string | null;
  strn: string | null;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  notes: string | null;
};

export function CompanyEditButton({ company }: { company: CompanyEditValues }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await updateCompany(company.id, {
          name: String(fd.get("name") || ""),
          ntn: String(fd.get("ntn") || "") || null,
          strn: String(fd.get("strn") || "") || null,
          industry: String(fd.get("industry") || "") || null,
          website: String(fd.get("website") || "") || null,
          phone: String(fd.get("phone") || "") || null,
          email: String(fd.get("email") || "") || null,
          address: String(fd.get("address") || "") || null,
          city: String(fd.get("city") || "") || null,
          postalCode: String(fd.get("postalCode") || "") || null,
          notes: String(fd.get("notes") || "") || null,
        });
        toast.success("Company updated");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 gap-1.5 border-slate-200 bg-white shadow-sm"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit profile
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit company</DialogTitle>
            <DialogDescription>
              Business details, tax IDs, and contact info
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSave}>
            <DialogBody className="grid max-h-[70vh] gap-3 overflow-y-auto sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="co-name">Company name</Label>
                <Input
                  id="co-name"
                  name="name"
                  required
                  defaultValue={company.name}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-industry">Industry</Label>
                <Input
                  id="co-industry"
                  name="industry"
                  placeholder="e.g. Insurance, Retail"
                  defaultValue={company.industry || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-website">Website</Label>
                <Input
                  id="co-website"
                  name="website"
                  placeholder="https://"
                  defaultValue={company.website || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-ntn">NTN</Label>
                <Input
                  id="co-ntn"
                  name="ntn"
                  placeholder="National Tax Number"
                  defaultValue={company.ntn || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-strn">STRN</Label>
                <Input
                  id="co-strn"
                  name="strn"
                  placeholder="Sales Tax Reg. No."
                  defaultValue={company.strn || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-phone">Phone</Label>
                <Input
                  id="co-phone"
                  name="phone"
                  defaultValue={company.phone || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-email">Email</Label>
                <Input
                  id="co-email"
                  name="email"
                  type="email"
                  defaultValue={company.email || ""}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="co-address">Address</Label>
                <Input
                  id="co-address"
                  name="address"
                  defaultValue={company.address || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-city">City</Label>
                <Input
                  id="co-city"
                  name="city"
                  defaultValue={company.city || ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-postal">Postal code</Label>
                <Input
                  id="co-postal"
                  name="postalCode"
                  defaultValue={company.postalCode || ""}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="co-notes">Notes</Label>
                <Textarea
                  id="co-notes"
                  name="notes"
                  rows={3}
                  placeholder="Account notes, billing instructions…"
                  defaultValue={company.notes || ""}
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
