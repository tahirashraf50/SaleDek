"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { getCurrencyMeta, type CurrencyMeta } from "@/lib/currency";
import { formatCurrency as formatCurrencyBase } from "@/lib/utils";

type Ctx = {
  currency: string;
  meta: CurrencyMeta;
  format: (value: number | string) => string;
};

const CurrencyContext = createContext<Ctx>({
  currency: "PKR",
  meta: getCurrencyMeta("PKR"),
  format: (v) => formatCurrencyBase(v, "PKR"),
});

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: React.ReactNode;
}) {
  const code = (currency || "PKR").toUpperCase();
  const value = useMemo<Ctx>(() => {
    const meta = getCurrencyMeta(code);
    return {
      currency: meta.code,
      meta,
      format: (v) => formatCurrencyBase(v, meta.code),
    };
  }, [code]);

  useEffect(() => {
    window.__ORG_CURRENCY__ = value.currency;
    return () => {
      delete window.__ORG_CURRENCY__;
    };
  }, [value.currency]);

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

export function useFormatCurrency() {
  return useCurrency().format;
}
