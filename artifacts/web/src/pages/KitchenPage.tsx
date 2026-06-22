import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, ChefHat } from "lucide-react";

interface KLine { id: string; name: string; quantity: string; notes: string | null }
interface KOrder {
  id: string; status: string; orderType: string; tableNumber: string | null;
  notes: string | null; createdAt: string; lines: KLine[];
}

const elapsedMins = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

function elapsedLabel(iso: string): string {
  const m = elapsedMins(iso);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// Urgency by wait time → left border + clock color.
function urgency(iso: string): string {
  const m = elapsedMins(iso);
  return m >= 20 ? "#ef4444" : m >= 10 ? "#f59e0b" : "#10b981";
}

export function KitchenPage() {
  const t = useT();
  const qc = useQueryClient();

  const { data: orders, isFetching } = useQuery({
    queryKey: ["kitchen"],
    queryFn: () => api.get("/orders/kitchen").then((r) => r.data as KOrder[]),
    refetchInterval: 15000, // poll — no websocket infra needed
  });

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitchen"] }),
    onError: (e: any) => toast({ title: t("kitchen.couldntUpdate"), description: e?.response?.data?.error ?? t("common.error"), variant: "destructive" }),
  });

  const typeLabel = (ot: string) =>
    ({ dine_in: t("sales.orderType.dineIn"), pickup: t("sales.orderType.pickup"), delivery: t("sales.orderType.delivery"), retail: t("sales.orderType.retail"), service: t("sales.orderType.service") } as Record<string, string>)[ot] ?? ot;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label={t("kitchen.back")}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ChefHat className="h-5 w-5 text-slate-500" /> {t("kitchen.title")}
          </h1>
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{(orders ?? []).length}</span>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> {t("kitchen.autoRefresh")}
        </span>
      </div>

      {(orders ?? []).length === 0 ? (
        <div className="flex h-[70vh] flex-col items-center justify-center text-slate-400">
          <ChefHat className="h-12 w-12" />
          <p className="mt-3 text-sm">{t("kitchen.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(orders ?? []).map((o) => {
            const isReady = o.status === "ready";
            return (
              <div
                key={o.id}
                className={`flex flex-col rounded-xl border bg-white shadow-sm ${isReady ? "opacity-60" : ""}`}
                style={{ borderLeftWidth: 4, borderLeftColor: isReady ? "#94a3b8" : urgency(o.createdAt) }}
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">#{o.id.slice(-6).toUpperCase()}</p>
                    <p className="text-xs text-slate-500">{typeLabel(o.orderType)}{o.tableNumber ? ` · ${t("kitchen.table")} ${o.tableNumber}` : ""}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: isReady ? "#94a3b8" : urgency(o.createdAt) }}>
                    {elapsedLabel(o.createdAt)}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5 px-3 py-2">
                  {o.lines.map((l) => (
                    <div key={l.id} className="text-sm">
                      <span className="font-semibold text-slate-900">{parseFloat(l.quantity)}×</span>{" "}
                      <span className="text-slate-800">{l.name}</span>
                      {l.notes && <p className="ml-5 text-xs font-medium text-red-600">{l.notes}</p>}
                    </div>
                  ))}
                  {o.notes && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">{o.notes}</p>}
                </div>

                <div className="border-t border-slate-100 p-2">
                  {o.status === "pending" || o.status === "confirmed" ? (
                    <button
                      onClick={() => advance.mutate({ id: o.id, status: "in_progress" })}
                      className="w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      {t("kitchen.btn.start")}
                    </button>
                  ) : o.status === "in_progress" ? (
                    <button
                      onClick={() => advance.mutate({ id: o.id, status: "ready" })}
                      className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      {t("kitchen.btn.ready")}
                    </button>
                  ) : (
                    <p className="py-1 text-center text-sm font-semibold text-emerald-600">{t("kitchen.status.ready")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
