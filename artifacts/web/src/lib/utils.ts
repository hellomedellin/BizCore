import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number, currencyCode = "USD", locale?: string) {
  // Intl already knows each currency's minor unit (COP → 0 decimals, USD → 2),
  // so we only pick a locale that reads naturally for the currency.
  const loc = locale ?? (currencyCode === "COP" ? "es-CO" : "en-US");
  return new Intl.NumberFormat(loc, { style: "currency", currency: currencyCode }).format(Number(amount));
}

// For per-unit COSTS (a rate, e.g. $0.25/lb), which are legitimately fractional
// even in zero-decimal currencies like COP. Shows up to 2 decimals — or 4 for
// very small rates — so a non-zero cost never renders as a bare "$0".
export function formatCost(amount: string | number, currencyCode = "USD", locale?: string) {
  const n = Number(amount);
  const loc = locale ?? (currencyCode === "COP" ? "es-CO" : "en-US");
  const maxFrac = n !== 0 && Math.abs(n) < 0.005 ? 4 : 2;
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}
