import { cache } from "react";

/** Per-request currency for RSC formatCurrency calls */
export const getRequestCurrencyStore = cache(() => ({
  currency: "PKR" as string,
}));

export function setRequestCurrency(currency: string) {
  getRequestCurrencyStore().currency = currency || "PKR";
}

export function getRequestCurrency() {
  return getRequestCurrencyStore().currency || "PKR";
}
