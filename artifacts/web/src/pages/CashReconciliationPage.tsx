import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocationContext } from "@/hooks/useLocation";
import { useCurrency } from "@/hooks/useCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Info, Wallet } from "lucide-react";

interface Recon {
  id: string; closedAt: string; expectedCash: string; countedCash: string; variance: string; notes: string | null;
}
interface ReconData { history: Recon[]; expectedNow: string; since: string | null }

// Colombian peso denominations (bills + coins). For other currencies we fall
// back to a single counted-total field.
const COP_DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];

export function CashReconciliationPage() {
  const t = useT();
  const qc = useQueryClient();
  const { activeLocationId } = useLocationContext();
  const { fmt, currency } = useCurrency();

  const [counts, setCounts] = useState<Record<string, string>>({});
  const [manual, setManual] = useState("");
  const [notes, setNotes] = useState("");

  const denoms = currency === "COP" ? COP_DENOMS : null;

  const { data } = useQuery({
    queryKey: ["cash-reconciliations", activeLocationId],
    queryFn: () => api.get(`/cash-reconciliations?locationId=${activeLocationId}`).then((r) => r.data as ReconData),
    enabled: !!activeLocationId,
  });

  const countedCash = useMemo(() => {
    if (denoms) return denoms.reduce((sum, d) => sum + d * (parseInt(counts[d] || "0", 10) || 0), 0);
    return parseFloat(manual || "0") || 0;
  }, [counts, manual, denoms]);

  const expected = parseFloat(data?.expectedNow ?? "0");
  const variance = countedCash - expected;

  const record = useMutation({
    mutationFn: () =>
      api.post("/cash-reconciliations", {
        locationId: activeLocationId,
        countedCash: countedCash.toFixed(2),
        denominations: denoms
          ? Object.fromEntries(denoms.map((d) => [d, parseInt(counts[d] || "0", 10) || 0]).filter(([, c]) => (c as number) > 0))
          : null,
        notes: notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-reconciliations"] });
      setCounts({});
      setManual("");
      setNotes("");
      toast({ title: t("cash.toast.recorded"), variant: "success" });
    },
    onError: (e: any) => toast({ title: t("cash.toast.couldntRecord"), description: e?.response?.data?.error ?? t("common.error"), variant: "destructive" }),
  });

  const varianceTone = Math.abs(variance) < 0.005 ? "text-emerald-600" : variance < 0 ? "text-red-600" : "text-amber-600";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("cash.title")}</h1>
        <p className="text-sm text-slate-500">{t("cash.subtitle")}</p>
      </div>

      {!activeLocationId ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{t("cash.noLocationBanner")}</span>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Count entry */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{t("cash.count.title")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {denoms ? (
                <div className="space-y-1.5">
                  {denoms.map((d) => (
                    <div key={d} className="flex items-center gap-3">
                      <span className="w-24 text-sm tabular-nums text-slate-600">{fmt(d)}</span>
                      <span className="text-slate-300">×</span>
                      <Input
                        className="h-8 w-20"
                        inputMode="numeric"
                        placeholder="0"
                        value={counts[d] ?? ""}
                        onChange={(e) => setCounts({ ...counts, [d]: e.target.value.replace(/\D/g, "") })}
                      />
                      <span className="ml-auto text-sm tabular-nums text-slate-500">
                        {fmt(d * (parseInt(counts[d] || "0", 10) || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm text-slate-600">{t("cash.count.countedLabel")}</label>
                  <Input inputMode="decimal" placeholder="0" value={manual} onChange={(e) => setManual(e.target.value)} />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm text-slate-600">{t("cash.count.notes")}</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("cash.count.notesPlaceholder")} />
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{t("cash.summary.title")}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Hint>{t("cash.summary.hint", { since: data?.since ? formatDateTime(data.since) : t("cash.summary.start") })}</Hint>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">{t("cash.summary.expected")}</span><span className="font-semibold tabular-nums">{fmt(expected)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t("cash.summary.counted")}</span><span className="font-semibold tabular-nums">{fmt(countedCash)}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-base">
                  <span className="font-semibold">{t("cash.summary.variance")}</span>
                  <span className={`font-bold tabular-nums ${varianceTone}`}>{variance > 0 ? "+" : ""}{fmt(variance)}</span>
                </div>
              </div>
              <Button className="w-full" disabled={record.isPending || countedCash <= 0} onClick={() => record.mutate()}>
                <Wallet className="mr-1.5 h-4 w-4" />
                {record.isPending ? t("common.saving") : t("cash.count.record")}
              </Button>
            </CardContent>
          </Card>

          {/* History */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base">{t("cash.history.title")}</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {!(data?.history.length) ? (
                <p className="px-5 py-6 text-sm text-slate-400">{t("cash.history.empty")}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-slate-600">{t("cash.history.when")}</th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("cash.summary.expected")}</th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("cash.summary.counted")}</th>
                      <th className="px-4 py-2.5 text-right font-medium text-slate-600">{t("cash.summary.variance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.history.map((r) => {
                      const v = parseFloat(r.variance);
                      const tone = Math.abs(v) < 0.005 ? "text-emerald-600" : v < 0 ? "text-red-600" : "text-amber-600";
                      return (
                        <tr key={r.id} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2.5 text-slate-600">{formatDateTime(r.closedAt)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{fmt(r.expectedCash)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{fmt(r.countedCash)}</td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${tone}`}>{v > 0 ? "+" : ""}{fmt(r.variance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
