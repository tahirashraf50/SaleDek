"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  IdCard,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  UserRound,
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
import { cn, formatCurrency } from "@/lib/utils";
import { createOrder } from "@/server/actions/sales";
import { findCustomerByCnic } from "@/server/actions/customers";
import {
  blanksToFormValues,
  calcPercentOfFieldPrice,
  formatLineName,
  type ProductFormField,
  type ProductPriceRule,
} from "@/lib/product-form";
import { PaymentMethod } from "@prisma/client";

type Lookup = {
  customers: { id: string; name: string; phone: string | null }[];
  products: {
    id: string;
    name: string;
    unitPrice: number;
    taxPercent: number;
    formFields: ProductFormField[];
    priceRule?: ProductPriceRule | null;
  }[];
};

type Line = {
  key: string;
  productId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  taxPercent: number;
  formFields: ProductFormField[];
  priceRule: ProductPriceRule | null;
  blanks: Record<string, string>;
  /** Agent overrode calculated price — don't auto-overwrite until they click Recalc */
  priceManual: boolean;
};

type CustomerDraft = {
  name: string;
  phone: string;
  email: string;
  cnic: string;
  city: string;
};

const EMPTY_CUSTOMER: CustomerDraft = {
  name: "",
  phone: "",
  email: "",
  cnic: "",
  city: "",
};

function lineKey() {
  return `line_${Math.random().toString(36).slice(2, 10)}`;
}

export function SaleModal({
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
    name?: string;
    phone?: string;
  };
}) {
  const formId = useId();
  const [pending, start] = useTransition();
  const [lookingUp, setLookingUp] = useState(false);
  const lockedCustomer = Boolean(preset?.customerId);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState(preset?.customerId || "");
  const [customer, setCustomer] = useState<CustomerDraft>({
    ...EMPTY_CUSTOMER,
    name: preset?.name || "",
    phone: preset?.phone || "",
  });
  const [cnicQuery, setCnicQuery] = useState("");
  const [loadedLabel, setLoadedLabel] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("BANK");
  const [installments, setInstallments] = useState(3);
  const packagesEndRef = useRef<HTMLDivElement>(null);
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

  const total = useMemo(
    () =>
      lines.reduce(
        (s, l) =>
          s +
          l.unitPrice * l.quantity +
          (l.unitPrice * l.quantity * l.taxPercent) / 100,
        0
      ),
    [lines]
  );

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
    setLines([]);
    setMethod("BANK");
    setInstallments(3);
  }, [
    open,
    preset?.customerId,
    preset?.conversationId,
    preset?.name,
    preset?.phone,
    lookup.customers,
  ]);

  useEffect(() => {
    if (!open || lines.length === 0) return;
    const t = window.setTimeout(() => {
      packagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 50);
    return () => window.clearTimeout(t);
  }, [lines.length, open]);

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
      });
      setCnicQuery(found.cnic || cnic);
      toast.success(`Loaded ${found.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }

  function setBlank(key: string, fieldId: string, value: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const blanks = { ...l.blanks, [fieldId]: value };
        if (l.priceManual) return { ...l, blanks };
        const catalogBase =
          lookup.products.find((p) => p.id === l.productId)?.unitPrice ??
          l.unitPrice;
        const unitPrice =
          calcPercentOfFieldPrice(blanks, l.priceRule) ?? catalogBase;
        return { ...l, blanks, unitPrice };
      })
    );
  }

  function addProduct(productId: string) {
    const p = lookup.products.find((x) => x.id === productId);
    if (!p) return;
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        productId: p.id,
        name: p.name,
        unitPrice: Number(p.unitPrice),
        quantity: 1,
        taxPercent: Number(p.taxPercent),
        formFields: p.formFields || [],
        priceRule: p.priceRule || null,
        blanks: {},
        priceManual: false,
      },
    ]);
  }

  function addCustomBlank() {
    setLines((prev) => [
      ...prev,
      {
        key: lineKey(),
        name: "",
        unitPrice: 0,
        quantity: 1,
        taxPercent: 0,
        formFields: [],
        priceRule: null,
        blanks: {},
        priceManual: true,
      },
    ]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lines.length) {
      toast.error("Add at least one package / line");
      return;
    }
    for (const l of lines) {
      if (!l.name.trim()) {
        toast.error("Fill package name on every line");
        return;
      }
      if (l.unitPrice < 0 || Number.isNaN(l.unitPrice)) {
        toast.error("Enter a valid price on every line");
        return;
      }
      for (const f of l.formFields) {
        if (f.required && !(l.blanks[f.id] || "").trim()) {
          toast.error(`Fill required field: ${f.label}`);
          return;
        }
      }
    }

    const fd = new FormData(e.currentTarget);
    const useExisting = lockedCustomer || mode === "existing";
    start(async () => {
      try {
        if (useExisting && !(customerId || fd.get("customerId"))) {
          throw new Error("Select a customer");
        }
        if (!useExisting && !customer.name.trim()) {
          throw new Error("Customer name is required");
        }

        await createOrder({
          customerId: useExisting
            ? String(fd.get("customerId") || customerId || "") || undefined
            : undefined,
          newCustomer: !useExisting
            ? {
                name: customer.name.trim(),
                phone: customer.phone.trim() || undefined,
                email: customer.email.trim() || undefined,
                city: customer.city.trim() || undefined,
                cnic: customer.cnic.trim() || undefined,
              }
            : undefined,
          items: lines.map((l) => ({
            productId: l.productId,
            name: formatLineName(l.name.trim(), l.formFields, l.blanks),
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            taxPercent: l.taxPercent,
            formValues: blanksToFormValues(l.formFields, l.blanks),
          })),
          paymentMethod: method,
          installmentCount: method === "INSTALLMENT" ? installments : undefined,
          conversationId: preset?.conversationId,
          notes: String(fd.get("notes") || "") || undefined,
        });
        toast.success("Sale created — payment pending");
        setLines([]);
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
      <DialogContent className="max-w-xl">
        <DialogHeader className="shrink-0 !py-3">
          <div className="flex items-center gap-2.5 pr-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ef1e1e] text-white shadow-sm shadow-red-500/20">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-base">New sale</DialogTitle>
              <DialogDescription className="text-xs">
                CNIC · package · payment
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
              <div className="rounded-lg border border-rose-100 bg-rose-50/80 px-2.5 py-1.5 text-[11px] text-rose-900">
                Sale for{" "}
                <span className="font-semibold">
                  {selectedName || "customer"}
                </span>
                {preset?.phone ? (
                  <span className="text-rose-700/80"> · {preset.phone}</span>
                ) : null}
              </div>
            ) : (
              <>
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
                        ? "border-[#ef1e1e]/40 bg-rose-50 text-[#ef1e1e] ring-1 ring-[#ef1e1e]/25"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md",
                        mode === "existing"
                          ? "bg-[#ef1e1e] text-white"
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
              <Field label="Customer *" htmlFor="sl-customer">
                {lockedCustomer ? (
                  <input type="hidden" name="customerId" value={customerId} />
                ) : null}
                <Select
                  id="sl-customer"
                  name={lockedCustomer ? undefined : "customerId"}
                  required={!lockedCustomer}
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    const c = customers.find((x) => x.id === e.target.value);
                    setLoadedLabel(c?.name || null);
                  }}
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
                  htmlFor="sl-name"
                >
                  <Input
                    id="sl-name"
                    required
                    value={customer.name}
                    onChange={(e) => setCustomerField("name", e.target.value)}
                    placeholder="e.g. Ahmed Khan"
                    className="h-9"
                  />
                </Field>
                <Field label="Phone" htmlFor="sl-phone">
                  <Input
                    id="sl-phone"
                    value={customer.phone}
                    onChange={(e) => setCustomerField("phone", e.target.value)}
                    placeholder="03xx xxx xxxx"
                    className="h-9"
                  />
                </Field>
                <Field label="Email" htmlFor="sl-email">
                  <Input
                    id="sl-email"
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomerField("email", e.target.value)}
                    placeholder="name@email.com"
                    className="h-9"
                  />
                </Field>
                <Field label="ID card (CNIC)" htmlFor="sl-cnic">
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="sl-cnic"
                      value={customer.cnic}
                      onChange={(e) => setCustomerField("cnic", e.target.value)}
                      placeholder="xxxxx-xxxxxxx-x"
                      className="h-9 pl-8"
                    />
                  </div>
                </Field>
                <Field label="City" htmlFor="sl-city">
                  <Input
                    id="sl-city"
                    value={customer.city}
                    onChange={(e) => setCustomerField("city", e.target.value)}
                    placeholder="Karachi…"
                    className="h-9"
                  />
                </Field>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Packages
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1">
                  <Label className="text-[11px] font-semibold text-slate-600">
                    Add package / policy
                  </Label>
                  <Select
                    className="mt-1 h-9"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addProduct(e.target.value);
                      e.target.value = "";
                    }}
                  >
                    <option value="">Select product…</option>
                    {lookup.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.priceRule
                          ? ` — ${p.priceRule.percent}% of form`
                          : ` — ${formatCurrency(Number(p.unitPrice))}`}
                        {p.formFields?.length ? " · form" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1 bg-white"
                  onClick={addCustomBlank}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Custom
                </Button>
              </div>

              {lines.length > 0 ? (
                <div className="mt-2.5 space-y-2">
                  {lines.map((l) => {
                    const sourceField = l.priceRule
                      ? l.formFields.find((f) => f.id === l.priceRule!.fieldId)
                      : null;
                    const calculated = calcPercentOfFieldPrice(
                      l.blanks,
                      l.priceRule
                    );
                    const lineTotal =
                      l.unitPrice * l.quantity +
                      (l.unitPrice * l.quantity * l.taxPercent) / 100;

                    return (
                      <div
                        key={l.key}
                        className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5"
                      >
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="col-span-2">
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Name
                            </Label>
                            <Input
                              className="mt-1 h-8"
                              value={l.name}
                              placeholder="Package name"
                              onChange={(e) =>
                                updateLine(l.key, { name: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Qty
                            </Label>
                            <Input
                              className="mt-1 h-8"
                              type="number"
                              min={1}
                              value={l.quantity}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  quantity: Number(e.target.value) || 1,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] font-semibold text-slate-600">
                              Price
                              {l.priceRule ? (
                                <span className="font-normal text-slate-400">
                                  {" "}
                                  ({l.priceRule.percent}%
                                  {sourceField
                                    ? ` · ${sourceField.label}`
                                    : ""}
                                  )
                                </span>
                              ) : null}
                            </Label>
                            <Input
                              className="mt-1 h-8"
                              type="number"
                              min={0}
                              step="0.01"
                              value={l.unitPrice}
                              onChange={(e) =>
                                updateLine(l.key, {
                                  unitPrice: Number(e.target.value) || 0,
                                  priceManual: true,
                                })
                              }
                            />
                            {l.priceRule ? (
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                                {calculated !== null ? (
                                  <span>
                                    Calc: {formatCurrency(calculated)}
                                    {l.priceManual ? " · edited" : ""}
                                  </span>
                                ) : (
                                  <span>
                                    Enter{" "}
                                    {sourceField?.label || "source amount"}
                                  </span>
                                )}
                                {l.priceManual && calculated !== null ? (
                                  <button
                                    type="button"
                                    className="font-medium text-[#ef1e1e] hover:underline"
                                    onClick={() =>
                                      updateLine(l.key, {
                                        unitPrice: calculated,
                                        priceManual: false,
                                      })
                                    }
                                  >
                                    Use calc
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {l.formFields.length > 0 ? (
                          <div className="grid gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-100 sm:grid-cols-2">
                            {l.formFields.map((f) => (
                              <div key={f.id}>
                                <Label className="text-[11px] font-semibold text-slate-600">
                                  {f.label}
                                  {f.required ? " *" : ""}
                                  {l.priceRule?.fieldId === f.id ? (
                                    <span className="ml-1 font-normal text-[#ef1e1e]">
                                      → {l.priceRule.percent}%
                                    </span>
                                  ) : null}
                                </Label>
                                {f.type === "select" ? (
                                  <Select
                                    className="mt-1 h-8"
                                    value={l.blanks[f.id] || ""}
                                    onChange={(e) =>
                                      setBlank(l.key, f.id, e.target.value)
                                    }
                                  >
                                    <option value="">Select…</option>
                                    {(f.options || "")
                                      .split(",")
                                      .map((o) => o.trim())
                                      .filter(Boolean)
                                      .map((o) => (
                                        <option key={o} value={o}>
                                          {o}
                                        </option>
                                      ))}
                                  </Select>
                                ) : (
                                  <Input
                                    className="mt-1 h-8"
                                    type={
                                      f.type === "number" ? "number" : "text"
                                    }
                                    value={l.blanks[f.id] || ""}
                                    placeholder={f.label}
                                    onChange={(e) =>
                                      setBlank(l.key, f.id, e.target.value)
                                    }
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate text-slate-500">
                            {formatLineName(
                              l.name || "—",
                              l.formFields,
                              l.blanks
                            )}
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(lineTotal)}
                            </span>
                            <button
                              type="button"
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              onClick={() =>
                                setLines((prev) =>
                                  prev.filter((x) => x.key !== l.key)
                                )
                              }
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="rounded-lg bg-rose-50 px-3 py-2 text-right text-sm font-bold text-[#ef1e1e]">
                    Total {formatCurrency(total)}
                  </div>
                  <div ref={packagesEndRef} />
                </div>
              ) : (
                <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                  Select a package above to start the sale
                </p>
              )}
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-100 bg-white p-3 ring-1 ring-slate-50">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Payment
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Method" htmlFor="sl-method">
                  <Select
                    id="sl-method"
                    className="h-9"
                    value={method}
                    onChange={(e) =>
                      setMethod(e.target.value as PaymentMethod)
                    }
                  >
                    <option value="BANK">Bank transfer</option>
                    <option value="JAZZCASH">JazzCash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="INSTALLMENT">Installment</option>
                  </Select>
                </Field>
                {method === "INSTALLMENT" ? (
                  <Field label="Installments" htmlFor="sl-inst">
                    <Select
                      id="sl-inst"
                      className="h-9"
                      value={String(installments)}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                    >
                      <option value="3">3 months</option>
                      <option value="6">6 months</option>
                      <option value="12">12 months</option>
                    </Select>
                  </Field>
                ) : (
                  <Field label="Notes" htmlFor="sl-notes">
                    <Input
                      id="sl-notes"
                      name="notes"
                      className="h-9"
                      placeholder="Payment reference…"
                    />
                  </Field>
                )}
                {method === "INSTALLMENT" ? (
                  <Field
                    className="sm:col-span-2"
                    label="Notes"
                    htmlFor="sl-notes-inst"
                  >
                    <Input
                      id="sl-notes-inst"
                      name="notes"
                      className="h-9"
                      placeholder="Payment reference…"
                    />
                  </Field>
                ) : null}
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="shrink-0 !py-2.5">
            <div className="mr-auto hidden text-xs text-slate-500 sm:block">
              {lines.length > 0 ? (
                <>
                  <span className="font-semibold text-slate-800">
                    {formatCurrency(total)}
                  </span>
                  <span className="text-slate-400">
                    {" "}
                    · {lines.length} line{lines.length === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                "Add a package to continue"
              )}
            </div>
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
              disabled={pending || lookingUp || !lines.length}
              className="min-w-[150px] bg-[#ef1e1e] text-white hover:bg-[#d41919]"
            >
              {pending ? "Saving…" : "Create sale"}
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
