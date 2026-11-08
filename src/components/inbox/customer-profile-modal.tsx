"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  updateCustomer,
  type CustomerProfileData,
} from "@/server/actions/customers";
import { CustomerDocuments } from "@/components/customers/customer-documents";
import { CustomerVehicles } from "@/components/customers/customer-vehicles";
import { extractVehiclePolicies } from "@/lib/product-form";
import { CustomerStatus } from "@prisma/client";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CustomerProfileModal({
  open,
  onOpenChange,
  profile,
  loading,
  justCreated,
  onProfileUpdated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: CustomerProfileData | null;
  loading?: boolean;
  justCreated?: boolean;
  onProfileUpdated?: (customerId: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  useEffect(() => {
    setEditing(false);
  }, [profile?.id]);

  const products =
    profile?.orders.flatMap((o) =>
      o.items.map((item) => ({
        ...item,
        orderId: o.id,
        orderNumber: o.number,
        paymentStatus: o.paymentStatus,
        date: o.createdAt,
      }))
    ) || [];

  const vehiclePolicies = profile
    ? extractVehiclePolicies(
        profile.orders.map((o) => ({
          id: o.id,
          number: o.number,
          paymentStatus: o.paymentStatus,
          total: o.total,
          createdAt: o.createdAt,
          items: o.items.map((i) => ({
            name: i.name,
            formValues: i.formValues,
          })),
        }))
      )
    : [];

  const lifetime =
    profile?.orders
      .filter((o) => o.paymentStatus === "PAID")
      .reduce((s, o) => s + o.total, 0) || 0;

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await updateCustomer(profile.id, {
          name: String(fd.get("name") || ""),
          phone: String(fd.get("phone") || "") || null,
          email: String(fd.get("email") || "") || null,
          cnic: String(fd.get("cnic") || "") || null,
          address: String(fd.get("address") || "") || null,
          city: String(fd.get("city") || "") || null,
          source: String(fd.get("source") || "") || null,
          status: String(fd.get("status") || "LEAD") as CustomerStatus,
          companyId: String(fd.get("companyId") || "") || null,
          jobTitle: String(fd.get("jobTitle") || "") || null,
          newCompanyName: String(fd.get("newCompanyName") || "") || null,
        });
        toast.success("Customer details saved");
        setEditing(false);
        await onProfileUpdated?.(profile.id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <div>
              <DialogTitle>Customer profile</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Update standard customer information."
                  : justCreated
                    ? "New customer saved to CRM — full purchase and service history."
                    : "CRM record with products, orders, tickets, and inbox history."}
              </DialogDescription>
            </div>
            {!loading && profile && !editing && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </Button>
            )}
            {editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            )}
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {loading && (
            <div className="py-12 text-center text-sm text-slate-500">Loading profile…</div>
          )}

          {!loading && profile && editing && (
            <form id="customer-edit-form" onSubmit={onSave} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Full name *</Label>
                  <Input name="name" required defaultValue={profile.name} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={profile.phone || ""} placeholder="03xxxxxxxxx" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    name="email"
                    type="email"
                    defaultValue={profile.email || ""}
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <Label>CNIC</Label>
                  <Input
                    name="cnic"
                    defaultValue={profile.cnic || ""}
                    placeholder="xxxxx-xxxxxxx-x"
                  />
                </div>
                <div>
                  <Label>City</Label>
                  <Input name="city" defaultValue={profile.city || ""} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea name="address" rows={2} defaultValue={profile.address || ""} />
                </div>
                <div>
                  <Label>Job title</Label>
                  <Input
                    name="jobTitle"
                    defaultValue={profile.jobTitle || ""}
                    placeholder="e.g. Accounts Manager"
                  />
                </div>
                <div>
                  <Label>Works at (company)</Label>
                  <Select name="companyId" defaultValue={profile.companyId || ""}>
                    <option value="">No company</option>
                    {profile.companies.map((c) => (
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
                  <Input
                    name="source"
                    defaultValue={profile.source || ""}
                    placeholder="WhatsApp, Walk-in, Referral…"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select name="status" defaultValue={profile.status}>
                    <option value="LEAD">Lead</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </div>
              </div>
            </form>
          )}

          {!loading && profile && !editing && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f6f3fb]0 to-[#8b10b8] text-sm font-semibold text-white">
                  {initials(profile.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-slate-900">
                      {profile.name}
                    </h3>
                    <Badge color={profile.status === "ACTIVE" ? "green" : "default"}>
                      {profile.status}
                    </Badge>
                    {justCreated && <Badge color="teal">Just created</Badge>}
                  </div>
                </div>
                <div className="flex gap-3 text-center text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Revenue</div>
                    <div className="font-semibold text-[#8b10b8]">
                      {formatCurrency(lifetime)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Orders</div>
                    <div className="font-semibold text-slate-900">{profile.orders.length}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Tickets</div>
                    <div className="font-semibold text-slate-900">{profile.tickets.length}</div>
                  </div>
                </div>
              </div>

              <section>
                <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Customer details
                </h4>
                <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
                  <table className="w-full text-xs">
                    <tbody>
                      {(
                        [
                          ["CNIC", profile.cnic],
                          ["Designation", profile.jobTitle],
                          ["Company", profile.companyName],
                          ["Email", profile.email],
                          ["Phone", profile.phone],
                          ["City", profile.city],
                          ["Address", profile.address],
                          ["Source", profile.source],
                        ] as const
                      ).map(([label, value]) => (
                        <tr key={label} className="border-t border-slate-100 first:border-0">
                          <th className="w-28 bg-slate-50 px-2.5 py-1.5 text-left font-medium text-slate-500">
                            {label}
                          </th>
                          <td className="px-2.5 py-1.5 text-slate-900">{value || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <CustomerDocuments
                customerId={profile.id}
                documents={profile.attachments || []}
                compact
                onChanged={async () => {
                  await onProfileUpdated?.(profile.id);
                }}
              />

              <CustomerVehicles policies={vehiclePolicies} compact />

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Products purchased
                </h4>
                {products.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    No products purchased yet.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-left text-slate-500">
                          <th className="px-3 py-2 font-medium">Product</th>
                          <th className="px-3 py-2 font-medium">Qty</th>
                          <th className="px-3 py-2 font-medium">Total</th>
                          <th className="px-3 py-2 font-medium">Order</th>
                          <th className="px-3 py-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.map((p) => (
                          <tr key={`${p.orderId}-${p.id}`} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-900">{p.name}</td>
                            <td className="px-3 py-2">{p.quantity}</td>
                            <td className="px-3 py-2">{formatCurrency(p.lineTotal)}</td>
                            <td className="px-3 py-2 text-[#8b10b8]">#{p.orderNumber}</td>
                            <td className="px-3 py-2 text-slate-500">{formatDate(p.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Order history
                </h4>
                <div className="space-y-2">
                  {profile.orders.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">
                          Order #{o.number}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge color={o.paymentStatus === "PAID" ? "green" : "amber"}>
                            {o.paymentStatus}
                          </Badge>
                          <span className="text-sm font-semibold">
                            {formatCurrency(o.total)}
                          </span>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1 border-t border-slate-200/70 pt-2">
                        {o.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between text-xs text-slate-600"
                          >
                            <span>
                              {item.name} × {item.quantity}
                            </span>
                            <span>{formatCurrency(item.lineTotal)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDateTime(o.createdAt)}
                      </p>
                    </div>
                  ))}
                  {profile.orders.length === 0 && (
                    <p className="text-sm text-slate-500">No orders yet</p>
                  )}
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-2">
                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Tickets
                  </h4>
                  <div className="space-y-1.5">
                    {profile.tickets.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border border-slate-100 px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-slate-900">
                          #{t.number} · {t.subject}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-xs text-slate-500">
                          <Badge color="teal">{t.stage}</Badge>
                          <span>{formatDate(t.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                    {profile.tickets.length === 0 && (
                      <p className="text-sm text-slate-500">No tickets</p>
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Inbox history
                  </h4>
                  <div className="space-y-1.5">
                    {profile.conversations.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-slate-100 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <Badge color="teal">{c.channel}</Badge>
                          <span className="truncate font-medium text-slate-800">
                            {c.subject || c.externalRef || "Thread"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {c.preview || "—"}
                        </p>
                      </div>
                    ))}
                    {profile.conversations.length === 0 && (
                      <p className="text-sm text-slate-500">No conversations</p>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter className="justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
            {editing && (
              <Button type="submit" form="customer-edit-form" disabled={pending}>
                {pending ? "Saving…" : "Save details"}
              </Button>
            )}
            {!editing && profile && (
              <Link href={`/customers/${profile.id}`} onClick={() => onOpenChange(false)}>
                <Button variant="secondary">Open full page</Button>
              </Link>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
