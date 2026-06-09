import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: string | number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(Number(amount));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(date));
}

export function formatDateTime(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}
