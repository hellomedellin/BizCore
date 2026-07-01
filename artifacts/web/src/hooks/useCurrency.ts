import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatCost } from "@/lib/utils";

// Reads the business's configured currency and returns a bound formatter.
// Use `fmt(amount)` anywhere you'd reach for a hardcoded currency — it respects
// the business setting (COP for a Colombian restaurant) instead of defaulting
// to USD. For amounts that already carry their own currency (e.g. an order's
// currencyCode), keep passing it to formatCurrency directly.
export function useCurrency() {
  const { data } = useQuery({
    queryKey: ["businesses", "me"],
    queryFn: () => api.get("/businesses/me").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const currency = (data?.currencyCode as string | undefined) ?? "USD";

  // Decimal places for this currency per Intl (COP/JPY → 0, USD/EUR → 2).
  let decimals = 2;
  try {
    decimals = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch { /* unknown currency → keep 2 */ }

  // Round a value to the currency's precision (e.g. 79.50 COP → 80).
  const round = (amount: number) => {
    const f = 10 ** decimals;
    return Math.round((amount + Number.EPSILON) * f) / f;
  };

  return {
    currency,
    decimals,
    round,
    fmt: (amount: string | number) => formatCurrency(amount, currency),
    // For per-unit costs / rates — shows decimals so a sub-unit cost isn't "$0".
    fmtCost: (amount: string | number) => formatCost(amount, currency),
  };
}
