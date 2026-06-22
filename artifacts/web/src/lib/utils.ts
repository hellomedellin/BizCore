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

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}
