export type CurrencyMeta = {
  code: string;
  label: string;
  locale: string;
  fractionDigits: number;
  symbol: string;
};

/** Currencies tenants can pick in Settings → Workspace */
export const ORG_CURRENCIES: CurrencyMeta[] = [
  { code: "PKR", label: "Pakistani Rupee (PKR)", locale: "en-PK", fractionDigits: 0, symbol: "Rs" },
  { code: "USD", label: "US Dollar (USD)", locale: "en-US", fractionDigits: 2, symbol: "$" },
  { code: "EUR", label: "Euro (EUR)", locale: "en-IE", fractionDigits: 2, symbol: "€" },
  { code: "GBP", label: "British Pound (GBP)", locale: "en-GB", fractionDigits: 2, symbol: "£" },
  { code: "AED", label: "UAE Dirham (AED)", locale: "en-AE", fractionDigits: 2, symbol: "AED" },
  { code: "SAR", label: "Saudi Riyal (SAR)", locale: "en-SA", fractionDigits: 2, symbol: "SAR" },
  { code: "INR", label: "Indian Rupee (INR)", locale: "en-IN", fractionDigits: 0, symbol: "₹" },
  { code: "CAD", label: "Canadian Dollar (CAD)", locale: "en-CA", fractionDigits: 2, symbol: "CA$" },
  { code: "AUD", label: "Australian Dollar (AUD)", locale: "en-AU", fractionDigits: 2, symbol: "A$" },
];

const META_BY_CODE = Object.fromEntries(
  ORG_CURRENCIES.map((c) => [c.code, c])
) as Record<string, CurrencyMeta>;

/** Platform SaaS plan / invoice currency (admin plans, public pricing). */
export const PLATFORM_BILLING_CURRENCY = "USD";

export function getCurrencyMeta(code: string | null | undefined): CurrencyMeta {
  const key = (code || "PKR").toUpperCase();
  return META_BY_CODE[key] || META_BY_CODE.PKR;
}

export function isSupportedCurrency(code: string) {
  return Boolean(META_BY_CODE[code.toUpperCase()]);
}
