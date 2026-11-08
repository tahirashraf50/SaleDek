"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct, updateProduct } from "@/server/actions/sales";
import type { ProductFormField, ProductPriceRule } from "@/lib/product-form";

export type ProductEditorValues = {
  id?: string;
  name: string;
  sku: string | null;
  description: string | null;
  unitPrice: number;
  taxPercent: number;
  category: string | null;
  imageUrl: string | null;
  active: boolean;
  formFields: ProductFormField[];
  priceRule?: ProductPriceRule | null;
};

function newField(): ProductFormField {
  return {
    id: `f_${Math.random().toString(36).slice(2, 9)}`,
    label: "",
    type: "text",
    required: false,
  };
}

export function ProductEditor({
  initial,
  onDone,
}: {
  initial?: ProductEditorValues | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const editing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name || "");
  const [sku, setSku] = useState(initial?.sku || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [unitPrice, setUnitPrice] = useState(String(initial?.unitPrice ?? ""));
  const [taxPercent, setTaxPercent] = useState(String(initial?.taxPercent ?? 0));
  const [category, setCategory] = useState(initial?.category || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [active, setActive] = useState(initial?.active ?? true);
  const [fields, setFields] = useState<ProductFormField[]>(
    initial?.formFields?.length ? initial.formFields : []
  );
  const [priceFromField, setPriceFromField] = useState(
    Boolean(initial?.priceRule?.fieldId)
  );
  const [priceFieldId, setPriceFieldId] = useState(
    initial?.priceRule?.fieldId || ""
  );
  const [pricePercent, setPricePercent] = useState(
    String(initial?.priceRule?.percent ?? 1)
  );

  const numberFields = fields.filter((f) => f.type === "number" && f.label.trim());

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number(unitPrice);
    if (!name.trim() || Number.isNaN(price)) {
      toast.error("Name and base price required");
      return;
    }
    const formFields = fields
      .map((f) => ({ ...f, label: f.label.trim() }))
      .filter((f) => f.label);

    let priceRule: ProductPriceRule | null = null;
    if (priceFromField) {
      const pct = Number(pricePercent);
      if (!priceFieldId) {
        toast.error("Select which field drives the policy price");
        return;
      }
      if (!Number.isFinite(pct) || pct < 0) {
        toast.error("Enter a valid percent (e.g. 1)");
        return;
      }
      if (!formFields.some((f) => f.id === priceFieldId && f.type === "number")) {
        toast.error("Price % field must be a Number field on this form");
        return;
      }
      priceRule = {
        type: "percent_of_field",
        fieldId: priceFieldId,
        percent: pct,
      };
    }

    start(async () => {
      try {
        if (editing && initial?.id) {
          await updateProduct(initial.id, {
            name: name.trim(),
            sku: sku.trim() || null,
            description: description.trim() || null,
            unitPrice: price,
            taxPercent: Number(taxPercent) || 0,
            category: category.trim() || null,
            imageUrl: imageUrl.trim() || null,
            active,
            formFields,
            priceRule,
          });
          toast.success("Product updated");
        } else {
          await createProduct({
            name: name.trim(),
            sku: sku.trim() || undefined,
            description: description.trim() || undefined,
            unitPrice: price,
            taxPercent: Number(taxPercent) || 0,
            category: category.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
            formFields,
            priceRule,
          });
          toast.success("Product created");
          setName("");
          setSku("");
          setDescription("");
          setUnitPrice("");
          setTaxPercent("0");
          setCategory("");
          setImageUrl("");
          setFields([]);
          setPriceFromField(false);
          setPriceFieldId("");
          setPricePercent("1");
        }
        router.refresh();
        onDone?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>Name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>SKU</Label>
          <Input value={sku} onChange={(e) => setSku(e.target.value)} />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Base / fallback price *</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
          <p className="mt-0.5 text-[10px] text-slate-400">
            Used if % rule is off, or until the linked field is filled on sale.
          </p>
        </div>
        <div>
          <Label>Tax %</Label>
          <Input
            type="number"
            min={0}
            value={taxPercent}
            onChange={(e) => setTaxPercent(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>Image URL</Label>
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {editing && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Active in catalog
        </label>
      )}

      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-800">Custom form fields</p>
            <p className="text-[11px] text-slate-500">
              Agents fill these blanks on New Sale (Vehicle Purchase, months…).
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFields((f) => [...f, newField()])}
          >
            <Plus className="h-3.5 w-3.5" /> Field
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="text-xs text-slate-400">No custom fields — optional.</p>
        ) : (
          <div className="space-y-2">
            {fields.map((f, idx) => (
              <div
                key={f.id}
                className="grid gap-1.5 rounded-md bg-white p-2 ring-1 ring-slate-100 sm:grid-cols-[1fr_7rem_1fr_auto]"
              >
                <Input
                  placeholder="Label e.g. Vehicle Purchase"
                  value={f.label}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, label: e.target.value } : x
                      )
                    )
                  }
                  className="h-8 text-xs"
                />
                <Select
                  value={f.type}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              type: e.target.value as ProductFormField["type"],
                            }
                          : x
                      )
                    )
                  }
                  className="h-8 text-xs"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="select">Select</option>
                </Select>
                {f.type === "select" ? (
                  <Input
                    placeholder="Options: A, B, C"
                    value={f.options || ""}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, options: e.target.value } : x
                        )
                      )
                    }
                    className="h-8 text-xs"
                  />
                ) : (
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={Boolean(f.required)}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, required: e.target.checked } : x
                          )
                        )
                      }
                    />
                    Required
                  </label>
                )}
                <button
                  type="button"
                  className="justify-self-end rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => {
                    setFields((prev) => prev.filter((_, i) => i !== idx));
                    if (priceFieldId === f.id) setPriceFieldId("");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3">
        <label className="flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={priceFromField}
            onChange={(e) => {
              setPriceFromField(e.target.checked);
              if (e.target.checked && !priceFieldId && numberFields[0]) {
                setPriceFieldId(numberFields[0].id);
              }
            }}
          />
          <span>
            <span className="font-medium">Policy price = % of a form field</span>
            <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
              e.g. 1% of Vehicle Purchase. Agents can still edit the price on New Sale.
            </span>
          </span>
        </label>
        {priceFromField && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-[11px]">Source field (number)</Label>
              <Select
                className="h-8"
                value={priceFieldId}
                onChange={(e) => setPriceFieldId(e.target.value)}
              >
                <option value="">Select field…</option>
                {numberFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </Select>
              {numberFields.length === 0 && (
                <p className="mt-1 text-[10px] text-amber-700">
                  Add a Number field above (e.g. Vehicle Purchase) first.
                </p>
              )}
            </div>
            <div>
              <Label className="text-[11px]">Percent %</Label>
              <Input
                className="h-8"
                type="number"
                min={0}
                step="0.01"
                value={pricePercent}
                onChange={(e) => setPricePercent(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-[#ef1e1e] text-white hover:bg-[#d41919]"
        disabled={pending}
      >
        {pending ? "Saving…" : editing ? "Save product" : "Create product"}
      </Button>
    </form>
  );
}
