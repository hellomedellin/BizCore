// Money is computed in integer minor units ("cents") to avoid floating-point
// drift, then serialized to fixed(2) decimal strings for the numeric DB columns.
// (For zero-decimal currencies like COP the value is still stored as N.00; the
// display layer rounds to whole units — see the i18n/formatting work.)

export interface LineModifier {
  name: string;
  priceAdjustment: number;
}

export function toCents(amount: string | number | null | undefined): number {
  const n = parseFloat(String(amount ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToString(cents: number): string {
  return (cents / 100).toFixed(2);
}

// Per-line total (in cents), including per-unit modifier price adjustments.
export function lineTotalCents(
  unitPrice: string | number,
  quantity: string | number,
  modifiers?: LineModifier[] | null,
): number {
  const modifierPerUnitCents = (modifiers ?? []).reduce((sum, m) => sum + toCents(m.priceAdjustment), 0);
  const qty = parseFloat(String(quantity));
  const perUnitCents = toCents(unitPrice) + modifierPerUnitCents;
  return Math.round(perUnitCents * (Number.isFinite(qty) ? qty : 0));
}

export interface OrderTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  lineTotalsCents: number[];
}

// Authoritative server-side order math. Modifiers are included in line totals;
// discount/tax are clamped non-negative. All arithmetic is integer-cent.
export function computeOrderTotals(
  lines: Array<{ unitPrice: string; quantity: string; modifiers?: LineModifier[] | null }>,
  discount: string | number,
  tax: string | number,
): OrderTotals {
  const lineTotalsCents = lines.map((l) => lineTotalCents(l.unitPrice, l.quantity, l.modifiers ?? null));
  const subtotalCents = lineTotalsCents.reduce((a, b) => a + b, 0);
  const discountCents = Math.max(0, toCents(discount));
  const taxCents = Math.max(0, toCents(tax));
  const totalCents = subtotalCents - discountCents + taxCents;
  return { subtotalCents, discountCents, taxCents, totalCents, lineTotalsCents };
}
