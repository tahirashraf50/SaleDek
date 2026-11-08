"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  IdCard,
  Search,
  ShoppingCart,
  Ticket,
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
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createCustomer,
  findCustomerByCnic,
  listCompaniesLite,
  updateCustomer,
} from "@/server/actions/customers";

const SOURCES = [
  "Walk-in",
  "Referral",
  "WhatsApp",
  "Phone",
  "Website",
  "Social",
  "Partner",
  "Other",
] as const;

type NextIntent = "save" | "sale" | "complaint";

type FormState = {
  name: string;
  phone: string;
  email: string;
  cnic: string;
  jobTitle: string;
  city: string;
  address: string;
  companyId: string;
  newCompanyName: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  email: "",
  cnic: "",
  jobTitle: "",
  city: "",
  address: "",
  companyId: "",
  newCompanyName: "",
};

export function CustomerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lookingUp, setLookingUp] = useState(false);
  const [intent, setIntent] = useState<NextIntent>("save");
  const [source, setSource] = useState<string>("Walk-in");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>(
    []
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [existingLabel, setExistingLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIntent("save");
    setSource("Walk-in");
    setForm(EMPTY_FORM);
    setExistingId(null);
    setExistingLabel(null);
    listCompaniesLite()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [open]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "cnic") {
      setExistingId(null);
      setExistingLabel(null);
    }
  }

  async function lookupByCnic() {
    const cnic = form.cnic.trim();
    if (cnic.replace(/\D/g, "").length < 5) {
      toast.error("Enter a valid CNIC / ID card number");
      return;
    }
    setLookingUp(true);
    try {
      const found = await findCustomerByCnic(cnic);
      if (!found) {
        setExistingId(null);
        setExistingLabel(null);
        toast.message("No existing customer — fill details below");
        return;
      }
      const jobTitle =
        found.customData &&
        typeof found.customData === "object" &&
        typeof (found.customData as Record<string, unknown>).jobTitle ===
          "string"
          ? String((found.customData as Record<string, unknown>).jobTitle)
          : "";

      setExistingId(found.id);
      setExistingLabel(found.name);
      if (
        found.source &&
        SOURCES.includes(found.source as (typeof SOURCES)[number])
      ) {
        setSource(found.source);
      } else if (found.source) {
        setSource("Other");
      }
      setForm({
        name: found.name || "",
        phone: found.phone || "",
        email: found.email || "",
        cnic: found.cnic || cnic,
        jobTitle,
        city: found.city || "",
        address: found.address || "",
        companyId: found.companyId || "",
        newCompanyName: "",
      });
      if (
        found.company &&
        !companies.some((c) => c.id === found.company!.id)
      ) {
        setCompanies((prev) => [
          { id: found.company!.id, name: found.company!.name },
          ...prev,
        ]);
      }
      toast.success(`Loaded ${found.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  function collectSource(fd: FormData) {
    return source === "Other"
      ? String(fd.get("sourceOther") || "").trim() || "Other"
      : source;
  }

  async function saveCustomer(fd: FormData) {
    const sourceValue = collectSource(fd);
    const name = form.name.trim();
    if (!name) throw new Error("Name is required");

    const phone = form.phone.trim() || undefined;
    const email = form.email.trim() || undefined;
    const cnic = form.cnic.trim() || undefined;
    const city = form.city.trim() || undefined;
    const address = form.address.trim() || undefined;
    const companyId = form.companyId || undefined;
    const newCompanyName = form.newCompanyName.trim() || undefined;
    const jobTitle = form.jobTitle.trim() || undefined;

    if (existingId) {
      await updateCustomer(existingId, {
        name,
        phone: phone || "",
        email: email || "",
        cnic: cnic || "",
        city: city || "",
        address: address || "",
        source: sourceValue || "",
        status: intent === "sale" ? "ACTIVE" : "LEAD",
        companyId: companyId || null,
        newCompanyName: newCompanyName || null,
        jobTitle: jobTitle || null,
      });
      return { id: existingId, name, phone: phone || null };
    }

    const customer = await createCustomer({
      name,
      phone,
      email,
      cnic,
      city,
      address,
      source: sourceValue || undefined,
      status: intent === "sale" ? "ACTIVE" : "LEAD",
      companyId,
      newCompanyName,
      jobTitle,
    });
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    };
  }

  function finishWithCustomer(
    customer: { id: string; name: string; phone: string | null },
    next: NextIntent
  ) {
    onOpenChange(false);
    if (next === "sale") {
      toast.success("Customer ready — open sale");
      window.dispatchEvent(
        new CustomEvent("pulse:sale", {
          detail: {
            customerId: customer.id,
            name: customer.name,
            phone: customer.phone || undefined,
          },
        })
      );
      return;
    }
    if (next === "complaint") {
      toast.success("Customer ready — open complaint");
      window.dispatchEvent(
        new CustomEvent("pulse:complaint", {
          detail: {
            customerId: customer.id,
            name: customer.name,
            phone: customer.phone || undefined,
            channel: "WALK_IN",
          },
        })
      );
      return;
    }
    toast.success(existingId ? "Customer updated" : "Customer created");
    router.push(`/customers/${customer.id}`);
    router.refresh();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = intent;
    start(async () => {
      try {
        const customer = await saveCustomer(fd);
        finishWithCustomer(customer, next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function saveOnly() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    start(async () => {
      try {
        const customer = await saveCustomer(fd);
        finishWithCustomer(customer, "save");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const primaryLabel =
    intent === "sale"
      ? pending
        ? "Opening sale…"
        : "Next: New sale"
      : intent === "complaint"
        ? pending
          ? "Opening complaint…"
          : "Next: New complaint"
        : pending
          ? existingId
            ? "Saving…"
            : "Creating…"
          : existingId
            ? "Save customer"
            : "Create customer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="shrink-0 !py-3">
          <div className="flex items-center gap-2.5 pr-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ef1e1e] text-white shadow-sm shadow-red-500/20">
              <UserPlus className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-base">
                {existingId ? "Customer found" : "New customer"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                CNIC lookup · then Sale or Complaint
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          id={formId}
          ref={formRef}
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="min-h-0 space-y-3 overflow-y-auto overscroll-contain !py-3">
            {/* CNIC + Fetch */}
            <div className="space-y-1.5">
              <Label
                htmlFor="cu-cnic"
                className="text-[11px] font-semibold text-slate-600"
              >
                ID card (CNIC)
              </Label>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <IdCard className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="cu-cnic"
                    name="cnic"
                    value={form.cnic}
                    onChange={(e) => setField("cnic", e.target.value)}
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
              {existingId && existingLabel ? (
                <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800">
                  Loaded <span className="font-semibold">{existingLabel}</span> —
                  no duplicate will be created
                </p>
              ) : null}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Full name *" htmlFor="cu-name">
                <Input
                  id="cu-name"
                  name="name"
                  required
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Ahmed Khan"
                  className="h-9"
                />
              </Field>
              <Field label="Phone" htmlFor="cu-phone">
                <Input
                  id="cu-phone"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder="03xx xxx xxxx"
                  className="h-9"
                />
              </Field>
              <Field label="Email" htmlFor="cu-email">
                <Input
                  id="cu-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder="name@email.com"
                  className="h-9"
                />
              </Field>
              {!existingId ? (
                <Field
                  className="sm:col-span-2"
                  label="ID card (CNIC)"
                  htmlFor="cu-cnic-form"
                >
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="cu-cnic-form"
                      value={form.cnic}
                      onChange={(e) => setField("cnic", e.target.value)}
                      placeholder="xxxxx-xxxxxxx-x"
                      className="h-9 pl-8"
                    />
                  </div>
                </Field>
              ) : null}
              <Field label="Company" htmlFor="cu-company">
                <Select
                  id="cu-company"
                  name="companyId"
                  value={form.companyId}
                  onChange={(e) => setField("companyId", e.target.value)}
                  className="h-9"
                >
                  <option value="">No company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Or new company" htmlFor="cu-newco">
                <Input
                  id="cu-newco"
                  name="newCompanyName"
                  value={form.newCompanyName}
                  onChange={(e) => setField("newCompanyName", e.target.value)}
                  placeholder="Create & link"
                  className="h-9"
                />
              </Field>
              <Field label="City" htmlFor="cu-city">
                <Input
                  id="cu-city"
                  name="city"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="Karachi…"
                  className="h-9"
                />
              </Field>
              <Field label="Source" htmlFor="cu-source">
                <Select
                  id="cu-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="h-9"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              {source === "Other" ? (
                <Field
                  className="sm:col-span-2"
                  label="Custom source"
                  htmlFor="cu-source-other"
                >
                  <Input
                    id="cu-source-other"
                    name="sourceOther"
                    placeholder="How did they find you?"
                    className="h-9"
                  />
                </Field>
              ) : null}
              <Field label="Job title" htmlFor="cu-job">
                <Input
                  id="cu-job"
                  name="jobTitle"
                  value={form.jobTitle}
                  onChange={(e) => setField("jobTitle", e.target.value)}
                  placeholder="Optional"
                  className="h-9"
                />
              </Field>
              <Field label="Address" htmlFor="cu-address">
                <Input
                  id="cu-address"
                  name="address"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  placeholder="Street / area"
                  className="h-9"
                />
              </Field>
            </div>

            {/* Sale / Complaint — compact */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "sale" as const,
                    label: "Sale",
                    icon: ShoppingCart,
                    active:
                      "border-[#ef1e1e]/40 bg-rose-50 text-[#ef1e1e] ring-1 ring-[#ef1e1e]/25",
                    iconActive: "bg-[#ef1e1e] text-white",
                  },
                  {
                    value: "complaint" as const,
                    label: "Complaint",
                    icon: Ticket,
                    active:
                      "border-[rgba(172,22,224,0.35)] bg-[rgba(172,22,224,0.08)] text-[#8b10b8] ring-1 ring-[rgba(172,22,224,0.25)]",
                    iconActive: "bg-[#ac16e0] text-white",
                  },
                ] as const
              ).map((n) => {
                const Icon = n.icon;
                const on = intent === n.value;
                return (
                  <button
                    key={n.value}
                    type="button"
                    onClick={() => setIntent(on ? "save" : n.value)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                      on
                        ? n.active
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md",
                        on ? n.iconActive : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {n.label}
                  </button>
                );
              })}
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
            {intent !== "save" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={saveOnly}
              >
                {existingId ? "Save only" : "Create only"}
              </Button>
            ) : null}
            <Button
              type="submit"
              form={formId}
              size="sm"
              disabled={pending || lookingUp}
              className={cn(
                "min-w-[130px] text-white",
                intent === "complaint"
                  ? "bg-[#ac16e0] hover:bg-[#8b10b8]"
                  : "bg-[#ef1e1e] hover:bg-[#d41919]"
              )}
            >
              {primaryLabel}
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
