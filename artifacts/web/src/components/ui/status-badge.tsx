import { cn } from "@/lib/utils";

// One badge, one meaning. Every domain state (order status, payment method,
// stock level, time-entry status, PO status) maps to a shared "tone" so the
// same concept looks identical on every screen. Pages pass the translated
// label as children; the tone mappers below decide the color.

const toneClasses = {
  neutral: "bg-slate-100 text-slate-600",
  positive: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  accent: "bg-violet-100 text-violet-700",
} as const;

export type Tone = keyof typeof toneClasses;

export function StatusBadge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Domain → tone mappers (the single source of truth for status color) ──

export const orderTone = (status: string): Tone =>
  (({
    pending: "warning",
    confirmed: "info",
    in_progress: "info",
    ready: "accent",
    completed: "positive",
    cancelled: "danger",
  }) as Record<string, Tone>)[status] ?? "neutral";

export const timeTone = (status: string): Tone =>
  (({ pending: "warning", approved: "positive", rejected: "danger" }) as Record<string, Tone>)[
    status
  ] ?? "neutral";

export const poTone = (status: string): Tone =>
  (({
    draft: "neutral",
    ai_processing: "info",
    ai_complete: "info",
    submitted: "info",
    received: "positive",
    cancelled: "danger",
  }) as Record<string, Tone>)[status] ?? "neutral";

export const stockTone = (isLow: boolean): Tone => (isLow ? "danger" : "positive");

export const paymentTone = (_method: string): Tone => "positive";
