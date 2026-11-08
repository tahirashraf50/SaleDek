"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { CustomerStatus } from "@prisma/client";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomer } from "@/server/actions/customers";

export type CustomerEditValues = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnic: string | null;
  address: string | null;
  city: string | null;
  source: string | null;
  status: CustomerStatus;
  companyId: string | null;
  jobTitle: string | null;
  companies: { id: string; name: string }[];
};

export function CustomerEditButton({ customer }: { customer: CustomerEditValues }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await updateCustomer(customer.id, {
          name: String(fd.get("name") || ""),
          phone: String(fd.get("phone") || "") || undefined,
          email: String(fd.get("email") || "") || undefined,
          cnic: String(fd.get("cnic") || "") || undefined,
          address: String(fd.get("address") || "") || undefined,
          city: String(fd.get("city") || "") || undefined,
          source: String(fd.get("source") || "") || undefined,
          status: String(fd.get("status") || "LEAD") as CustomerStatus,
          companyId: String(fd.get("companyId") || "") || null,
          jobTitle: String(fd.get("jobTitle") || "") || null,
          newCompanyName: String(fd.get("newCompanyName") || "") || null,
        });
        toast.success("Customer details saved");
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit details
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>
              Update email, CNIC, workplace, and other standard fields.
            </DialogDescription>
          </DialogHeader>
          <form id="customer-page-edit" onSubmit={onSave}>
            <DialogBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Full name *</Label>
                  <Input name="name" required defaultValue={customer.name} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={customer.phone || ""} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    name="email"
                    type="email"
                    defaultValue={customer.email || ""}
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <Label>CNIC</Label>
                  <Input
                    name="cnic"
                    defaultValue={customer.cnic || ""}
                    placeholder="xxxxx-xxxxxxx-x"
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input name="city" defaultValue={customer.city || ""} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea name="address" rows={2} defaultValue={customer.address || ""} />
                </div>
                <div>
                  <Label>Job title</Label>
                  <Input
                    name="jobTitle"
                    defaultValue={customer.jobTitle || ""}
                    placeholder="e.g. Accounts Manager"
                  />
                </div>
                <div>
                  <Label>Works at (company)</Label>
                  <Select name="companyId" defaultValue={customer.companyId || ""}>
                    <option value="">No company</option>
                    {customer.companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Or add new company / workplace</Label>
                  <Input
                    name="newCompanyName"
                    placeholder="Type company name to create & link"
                  />
                </div>
                <div>
                  <Label>Source</Label>
                  <Input name="source" defaultValue={customer.source || ""} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select name="status" defaultValue={customer.status}>
                    <option value="LEAD">Lead</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </div>
              </div>
            </DialogBody>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="customer-page-edit" disabled={pending}>
              {pending ? "Saving…" : "Save details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
