"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  IdCard,
  Search,
  Ticket,
  UserRound,
  UserPlus,
} from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createTicket } from "@/server/actions/tickets";
import { findCustomerByCnic } from "@/server/actions/customers";
import { TicketChannel, TicketPriority } from "@prisma/client";

type Lookup = {
  customers: { id: string; name: string; phone: string | null }[];
  departments: { id: string; name: string }[];
  ticketTypes: { id: string; name: string }[];
  users: { id: string; name: string }[];
  products: { id: string; name: string; unitPrice: number; taxPercent: number }[];
};

type CustomerDraft = {
  name: string;
  phone: string;
  email: string;
  cnic: string;
  city: string;
  address: string;
};

const EMPTY_CUSTOMER: CustomerDraft = {
  name: "",
  phone: "",
  email: "",
  cnic: "",
  city: "",
  address: "",
};

export function ComplaintModal({
  open,
  onOpenChange,
  lookup,
  preset,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lookup: Lookup;
  preset?: {
    customerId?: string;
    conversationId?: string;
    channel?: TicketChannel;
    phone?: string;
    name?: string;
  };
}) {
  const formId = useId();
  const [pending, start] = useTransition();
  const [lookingUp, setLookingUp] = useState(false);
  const lockedCustomer = Boolean(preset?.customerId);
  const [mode, setMode] = useState<"existing" | "new">(
    preset?.customerId ? "existing" : "existing"
  );
  const [customerId, setCustomerId] = useState(preset?.customerId || "");
  const [customer, setCustomer] = useState<CustomerDraft>({
    ...EMPTY_CUSTOMER,
    name: preset?.name || "",
    phone: preset?.phone || "",
  });
  const [cnicQuery, setCnicQuery] = useState("");
  const [loadedLabel, setLoadedLabel] = useState<string | null>(null);
  const formKey = `${open}-${preset?.customerId || ""}-${preset?.conversationId || ""}`;

  const customers = useMemo(() => {
    const list = [...lookup.customers];
    if (
      preset?.customerId &&
      !list.some((c) => c.id === preset.customerId)
    ) {
      list.unshift({
        id: preset.customerId,
        name: preset.name || "Selected customer",
        phone: preset.phone || null,
      });
    }
    return list;
  }, [lookup.customers, preset?.customerId, preset?.name, preset?.phone]);

  useEffect(() => {
    if (!open) return;
    setMode(preset?.customerId ? "existing" : "existing");
    setCustomerId(preset?.customerId || "");
    setCustomer({
      ...EMPTY_CUSTOMER,
      name: preset?.name || "",
      phone: preset?.phone || "",
    });
    setCnicQuery("");
    setLoadedLabel(
      preset?.customerId
        ? preset.name ||
            lookup.customers.find((c) => c.id === preset.customerId)?.name ||
            "Customer"
        : null
    );
  }, [open, preset?.customerId, preset?.conversationId, preset?.name, preset?.phone, lookup.customers]);

  function setCustomerField<K extends keyof CustomerDraft>(
    key: K,
    value: CustomerDraft[K]
  ) {
    setCustomer((prev) => ({ ...prev, [key]: value }));
  }

  async function lookupByCnic() {
    const cnic = cnicQuery.trim() || customer.cnic.trim();
    if (cnic.replace(/\D/g, "").length < 5) {
      toast.error("Enter a valid CNIC / ID card number");
      return;
    }
    setLookingUp(true);
    try {
      const found = await findCustomerByCnic(cnic);
      if (!found) {
        setMode("new");
        setCustomerId("");
        setLoadedLabel(null);
        setCustomerField("cnic", cnic);
        toast.message("No existing customer — fill details below");
        return;
      }
      setMode("existing");
      setCustomerId(found.id);
      setLoadedLabel(found.name);
      setCustomer({
        name: found.name || "",
        phone: found.phone || "",
        email: found.email || "",
        cnic: found.cnic || cnic,
        city: found.city || "",
        address: found.address || "",
      });
      setCnicQuery(found.cnic || cnic);
      toast.success(`Loaded ${found.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const useExisting = lockedCustomer || mode === "existing";
        const resolvedCustomerId = useExisting
          ? String(fd.get("customerId") || customerId || "") || undefined
          : undefined;

        if (useExisting && !resolvedCustomerId) {
          throw new Error("Select a customer");
        }
        if (!useExisting && !customer.name.trim()) {
          throw new Error("Customer name is required");
        }

        await createTicket({
          customerId: resolvedCustomerId,
          newCustomer: !useExisting
            ? {
                name: customer.name.trim(),
                phone: customer.phone.trim() || undefined,
                email: customer.email.trim() || undefined,
                cnic: customer.cnic.trim() || undefined,
                address: customer.address.trim() || undefined,
                city: customer.city.trim() || undefined,
              }
            : undefined,
          subject: String(fd.get("subject") || ""),
          description: String(fd.get("description") || ""),
          priority: String(fd.get("priority") || "MEDIUM") as TicketPriority,
          channel: String(fd.get("channel") || "PHONE") as TicketChannel,
          typeId: String(fd.get("typeId") || "") || undefined,
          departmentId: String(fd.get("departmentId") || "") || undefined,
          assigneeId: String(fd.get("assigneeId") || "") || undefined,
          productId: String(fd.get("productId") || "") || undefined,
          forwardNote: String(fd.get("forwardNote") || "") || undefined,
          conversationId: preset?.conversationId,
        });
        toast.success("Complaint created");
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const selectedName =
    loadedLabel ||
    customers.find((c) => c.id === customerId)?.name ||
    preset?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="shrink-0 !py-3">
          <div className="flex items-center gap-2.5 pr-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ac16e0] text-white shadow-sm shadow-[0_10px_24px_-12px_rgba(172,22,224,0.45)]">
              <Ticket className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-base">New complaint</DialogTitle>
              <DialogDescription className="text-xs">
                CNIC lookup · type · forward
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          key={formKey}
          id={formId}
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="min-h-0 space-y-3 overflow-y-auto overscroll-contain !py-3">
            {lockedCustomer ? (
              <div className="rounded-lg border border-[rgba(172,22,224,0.15)] bg-[rgba(172,22,224,0.08)]/80 px-2.5 py-1.5 text-[11px] text-[#5b0a7a]">
                For{" "}
                <span className="font-semibold">
                  {selectedName || "customer"}
                </span>
                {preset?.phone ? (
                  <span className="text-[#8b10b8]/80"> · {preset.phone}</span>
                ) : null}
              </div>
            ) : (
              <>
                {/* CNIC fetch */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-600">
                    ID card (CNIC)
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <IdCard className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={cnicQuery}
                        onChange={(e) => {
                          setCnicQuery(e.target.value);
                          setLoadedLabel(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void lookupByCnic();
                          }
                        }}
                        placeholder="xxxxx-xxxxxxx-x"
                        className="h-9 pl-8"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 gap-1"
                      disabled={lookingUp || pending}
                      onClick={() => void lookupByCnic()}
                    >
                      <Search className="h-3.5 w-3.5" />
                      {lookingUp ? "…" : "Fetch"}
                    </Button>
                  </div>
                  {loadedLabel && mode === "existing" && customerId ? (
                    <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800">
                      Loaded <span className="font-semibold">{loadedLabel}</span>
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("existing")}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                      mode === "existing"
                        ? "border-[rgba(172,22,224,0.35)] bg-[rgba(172,22,224,0.08)] text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.25)]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md",
                        mode === "existing"
                          ? "bg-[#ac16e0] text-white"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <UserRound className="h-3.5 w-3.5" />
                    </span>
                    Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("new");
                      setCustomerId("");
                      setLoadedLabel(null);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                      mode === "new"
                        ? "border-slate-300 bg-slate-50 text-slate-900 ring-1 ring-slate-200"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md",
                        mode === "new"
                          ? "bg-slate-800 text-white"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </span>
                    New
                  </button>
                </div>
              </>
            )}

            {mode === "existing" || lockedCustomer ? (
              <Field label="Customer *" htmlFor="cp-customer">
                {lockedCustomer ? (
                  <input type="hidden" name="customerId" value={customerId} />
                ) : null}
                <Select
                  id="cp-customer"
                  name={lockedCustomer ? undefined : "customerId"}
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    const c = customers.find((x) => x.id === e.target.value);
                    setLoadedLabel(c?.name || null);
                  }}
                  required={!lockedCustomer}
                  disabled={lockedCustomer}
                  className="h-9"
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` (${c.phone})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  label="Full name *"
                  htmlFor="cp-name"
                >
                  <Input
                    id="cp-name"
                    required
                    value={customer.name}
                    onChange={(e) => setCustomerField("name", e.target.value)}
                    placeholder="e.g. Ahmed Khan"
                    className="h-9"
                  />
                </Field>
                <Field label="Phone" htmlFor="cp-phone">
                  <Input
                    id="cp-phone"
                    value={customer.phone}
                    onChange={(e) => setCustomerField("phone", e.target.value)}
                    placeholder="03xx xxx xxxx"
                    className="h-9"
                  />
                </Field>
                <Field label="Email" htmlFor="cp-email">
                  <Input
                    id="cp-email"
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomerField("email", e.target.value)}
                    placeholder="name@email.com"
                    className="h-9"
                  />
                </Field>
                <Field label="ID card (CNIC)" htmlFor="cp-cnic">
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="cp-cnic"
                      value={customer.cnic}
                      onChange={(e) => setCustomerField("cnic", e.target.value)}
                      placeholder="xxxxx-xxxxxxx-x"
                      className="h-9 pl-8"
                    />
                  </div>
                </Field>
                <Field label="City" htmlFor="cp-city">
                  <Input
                    id="cp-city"
                    value={customer.city}
                    onChange={(e) => setCustomerField("city", e.target.value)}
                    placeholder="Karachi…"
                    className="h-9"
                  />
                </Field>
                <Field
                  className="sm:col-span-2"
                  label="Address"
                  htmlFor="cp-address"
                >
                  <Input
                    id="cp-address"
                    value={customer.address}
                    onChange={(e) =>
                      setCustomerField("address", e.target.value)
                    }
                    placeholder="Street / area"
                    className="h-9"
                  />
                </Field>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field
                  className="sm:col-span-2"
                  label="Subject *"
                  htmlFor="cp-subject"
                >
                  <Input
                    id="cp-subject"
                    name="subject"
                    required
                    placeholder="Short summary"
                    className="h-9"
                  />
                </Field>
                <Field
                  className="sm:col-span-2"
                  label="Description *"
                  htmlFor="cp-desc"
                >
                  <Textarea
                    id="cp-desc"
                    name="description"
                    required
                    rows={3}
                    placeholder="What happened…"
                    className="min-h-[72px] text-sm"
                  />
                </Field>
                <Field label="Priority" htmlFor="cp-priority">
                  <Select
                    id="cp-priority"
                    name="priority"
                    defaultValue="MEDIUM"
                    className="h-9"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </Select>
                </Field>
                <Field label="Channel" htmlFor="cp-channel">
                  <Select
                    id="cp-channel"
                    name="channel"
                    defaultValue={preset?.channel || "PHONE"}
                    className="h-9"
                  >
                    <option value="PHONE">Call / Phone</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="WALK_IN">Walk-in</option>
                    <option value="PORTAL">Portal</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </Field>
                <Field label="Complaint type" htmlFor="cp-type">
                  <Select
                    id="cp-type"
                    name="typeId"
                    defaultValue=""
                    className="h-9"
                  >
                    <option value="">Select…</option>
                    {lookup.ticketTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Linked product" htmlFor="cp-product">
                  <Select
                    id="cp-product"
                    name="productId"
                    defaultValue=""
                    className="h-9"
                  >
                    <option value="">None</option>
                    {lookup.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Forward to dept" htmlFor="cp-dept">
                  <Select
                    id="cp-dept"
                    name="departmentId"
                    defaultValue=""
                    className="h-9"
                  >
                    <option value="">Unassigned</option>
                    {lookup.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Assignee" htmlFor="cp-assignee">
                  <Select
                    id="cp-assignee"
                    name="assigneeId"
                    defaultValue=""
                    className="h-9"
                  >
                    <option value="">Queue</option>
                    {lookup.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  className="sm:col-span-2"
                  label="Forward note"
                  htmlFor="cp-note"
                >
                  <Textarea
                    id="cp-note"
                    name="forwardNote"
                    rows={2}
                    placeholder="Optional handoff note…"
                    className="min-h-[56px] text-sm"
                  />
                </Field>
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="shrink-0 !py-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              size="sm"
              disabled={pending || lookingUp}
              className="min-w-[140px] bg-[#ac16e0] text-white hover:bg-[#8b10b8]"
            >
              {pending ? "Saving…" : "Create complaint"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold text-slate-600"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
