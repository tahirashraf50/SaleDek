import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getCurrencyMeta, PLATFORM_BILLING_CURRENCY } from "@/lib/currency";
import { getRequestCurrency } from "@/lib/org-currency-store";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  // eslint-disable-next-line no-var
  var __ORG_CURRENCY__: string | undefined;
}

function resolveCurrency(explicit?: string) {
  if (explicit) return explicit;
  if (typeof window !== "undefined" && window.__ORG_CURRENCY__) {
    return window.__ORG_CURRENCY__;
  }
  try {
    return getRequestCurrency();
  } catch {
    return "PKR";
  }
}

export function formatCurrency(
  value: number | string,
  currency?: string
) {
  const n = typeof value === "string" ? Number(value) : value;
  const meta = getCurrencyMeta(resolveCurrency(currency));
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    maximumFractionDigits: meta.fractionDigits,
    minimumFractionDigits: meta.fractionDigits > 0 ? 0 : 0,
  }).format(n || 0);
}

/** SaaS plan prices / platform billing — always USD. */
export function formatPlatformCurrency(value: number | string) {
  return formatCurrency(value, PLATFORM_BILLING_CURRENCY);
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}
