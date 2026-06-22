import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

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
  return {
    currency,
    fmt: (amount: string | number) => formatCurrency(amount, currency),
  };
}
