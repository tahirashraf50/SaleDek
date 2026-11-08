export type ProductFormField = {
  id: string;
  label: string;
  type: "text" | "number" | "select";
  /** Comma-separated options when type=select */
  options?: string;
  required?: boolean;
};

/** Policy price = percent of a number form field (e.g. 1% of Vehicle Purchase). */
export type ProductPriceRule = {
  type: "percent_of_field";
  fieldId: string;
  percent: number;
};

export type ProductFormConfig = {
  fields: ProductFormField[];
  priceRule: ProductPriceRule | null;
};

export function parseProductFormFields(raw: unknown): ProductFormField[] {
  return parseProductFormConfig(raw).fields;
}

export function parsePriceRule(raw: unknown): ProductPriceRule | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.type !== "percent_of_field") return null;
  const fieldId = String(o.fieldId || "").trim();
  const percent = Number(o.percent);
  if (!fieldId || !Number.isFinite(percent) || percent < 0) return null;
  return { type: "percent_of_field", fieldId, percent };
}

/**
 * Supports legacy JSON array of fields, or `{ fields, priceRule }`.
 */
export function parseProductFormConfig(raw: unknown): ProductFormConfig {
  if (Array.isArray(raw)) {
    return { fields: parseFieldArray(raw), priceRule: null };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.fields)) {
      return {
        fields: parseFieldArray(o.fields),
        priceRule: parsePriceRule(o.priceRule),
      };
    }
  }
  return { fields: [], priceRule: null };
}

function parseFieldArray(raw: unknown[]): ProductFormField[] {
  return raw
    .map((item, i) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const label = String(o.label || "").trim();
      if (!label) return null;
      const type =
        o.type === "number" || o.type === "select" ? o.type : "text";
      return {
        id: String(o.id || `f${i}`),
        label,
        type,
        options: typeof o.options === "string" ? o.options : undefined,
        required: Boolean(o.required),
      } satisfies ProductFormField;
    })
    .filter(Boolean) as ProductFormField[];
}

/** Persist fields (+ optional % pricing rule) into Product.formFields JSON. */
export function serializeProductFormConfig(
  fields: ProductFormField[],
  priceRule?: ProductPriceRule | null
): ProductFormField[] | ProductFormConfig {
  const cleaned = fields
    .map((f) => ({ ...f, label: f.label.trim() }))
    .filter((f) => f.label);

  const rule = priceRule
    ? parsePriceRule({
        type: "percent_of_field",
        fieldId: priceRule.fieldId,
        percent: priceRule.percent,
      })
    : null;

  // Drop rule if its field was removed
  const validRule =
    rule && cleaned.some((f) => f.id === rule.fieldId) ? rule : null;

  if (!validRule) return cleaned;
  return { fields: cleaned, priceRule: validRule };
}

export function calcPercentOfFieldPrice(
  blanks: Record<string, string>,
  rule: ProductPriceRule | null | undefined
): number | null {
  if (!rule || rule.type !== "percent_of_field") return null;
  const raw = (blanks[rule.fieldId] || "").replace(/,/g, "").trim();
  if (!raw) return null;
  const base = Number(raw);
  if (!Number.isFinite(base) || base < 0) return null;
  // Round to 2 decimals (currency)
  return Math.round(((base * rule.percent) / 100) * 100) / 100;
}

export type OrderFormValue = {
  id?: string;
  label: string;
  value: string;
};

export function blanksToFormValues(
  fields: ProductFormField[],
  blanks: Record<string, string>
): OrderFormValue[] {
  return fields
    .map((f) => {
      const value = (blanks[f.id] || "").trim();
      if (!value) return null;
      return { id: f.id, label: f.label, value };
    })
    .filter(Boolean) as OrderFormValue[];
}

export function parseOrderFormValues(raw: unknown): OrderFormValue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const label = String(o.label || "").trim();
      const value = String(o.value || "").trim();
      if (!label || !value) return null;
      return {
        id: typeof o.id === "string" ? o.id : undefined,
        label,
        value,
      };
    })
    .filter(Boolean) as OrderFormValue[];
}

/** Labels that typically belong on a vehicle / motor policy card. */
const VEHICLE_LABEL_HINTS = [
  "make",
  "model",
  "registration",
  "reg no",
  "reg#",
  "manufacturing",
  "year",
  "engine",
  "capacity",
  "cc",
  "owned",
  "leased",
  "employee",
  "vehicle purchase",
  "purchase",
  "chassis",
  "vin",
  "color",
];

export function looksLikeVehicleField(label: string) {
  const l = label.toLowerCase();
  return VEHICLE_LABEL_HINTS.some((h) => l.includes(h));
}

export function extractVehiclePolicies(
  orders: {
    id: string;
    number: number;
    paymentStatus: string;
    total: number;
    createdAt: string | Date;
    policyNumber?: string | null;
    underwritingStatus?: string | null;
    policyDocumentId?: string | null;
    policyDocumentLabel?: string | null;
    items: {
      name: string;
      formValues?: OrderFormValue[] | unknown;
    }[];
  }[]
) {
  return orders.flatMap((o) =>
    o.items
      .map((item) => {
        const fields = parseOrderFormValues(item.formValues);
        if (!fields.length && !o.policyNumber) return null;
        const vehicleish = fields.some((f) => looksLikeVehicleField(f.label));
        // Show any filled sale form; highlight vehicle-style ones first
        const sorted = [...fields].sort((a, b) => {
          const av = looksLikeVehicleField(a.label) ? 0 : 1;
          const bv = looksLikeVehicleField(b.label) ? 0 : 1;
          return av - bv;
        });
        return {
          orderId: o.id,
          orderNumber: o.number,
          paymentStatus: o.paymentStatus,
          total: o.total,
          date:
            typeof o.createdAt === "string"
              ? o.createdAt
              : o.createdAt.toISOString(),
          productName: item.name.split(" · ")[0] || item.name,
          fields: sorted,
          isVehicle: vehicleish,
          policyNumber: o.policyNumber || null,
          underwritingStatus: o.underwritingStatus || null,
          policyDocumentId: o.policyDocumentId || null,
          policyDocumentLabel: o.policyDocumentLabel || null,
        };
      })
      .filter(Boolean)
  ) as {
    orderId: string;
    orderNumber: number;
    paymentStatus: string;
    total: number;
    date: string;
    productName: string;
    fields: OrderFormValue[];
    isVehicle: boolean;
    policyNumber: string | null;
    underwritingStatus: string | null;
    policyDocumentId: string | null;
    policyDocumentLabel: string | null;
  }[];
}

export function formatLineName(
  baseName: string,
  fields: ProductFormField[],
  blanks: Record<string, string>
) {
  const parts = fields
    .map((f) => {
      const v = (blanks[f.id] || "").trim();
      return v ? `${f.label}: ${v}` : null;
    })
    .filter(Boolean);
  if (!parts.length) return baseName;
  return `${baseName} · ${parts.join(" · ")}`;
}
