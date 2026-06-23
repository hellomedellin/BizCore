import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocationContext } from "@/hooks/useLocation";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import { Pencil, Plus, Trash2, Truck, Sparkles } from "lucide-react";

interface PO { id: string; supplierId: string | null; status: string; expectedAt: string | null; receivedAt: string | null; notes: string | null; createdAt: string }
interface POLine { id: string; description: string; quantity: string; unitCost: string; lineTotal: string }
interface Supplier { id: string; name: string }
interface Ingredient { itemId: string; itemName: string; variantId: string; variantName: string }
interface Unit { id: string; name: string; abbreviation: string }
interface BuilderLine { variantId: string; description: string; quantity: string; unitId: string; unitCost: string }

const statusVariant = (s: string): "success" | "secondary" | "warning" => (s === "received" ? "success" : s === "cancelled" ? "secondary" : "warning");

export function PurchasesPage() {
  const t = useT();
  const qc = useQueryClient();
  const { fmt } = useCurrency();
  const { activeLocationId, locations } = useLocationContext();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<BuilderLine[]>([]);
  const [add, setAdd] = useState({ variantId: "", quantity: "", unitId: "", unitCost: "" });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ supplierId: "", expectedAt: "", notes: "" });
  const [confirmCancel, setConfirmCancel] = useState(false);

  const STATUS_LABEL: Record<string, string> = {
    draft: t("purchases.status.draft"),
    ai_processing: t("purchases.status.aiProcessing"),
    ai_complete: t("purchases.status.aiComplete"),
    submitted: t("purchases.status.submitted"),
    received: t("purchases.status.received"),
    cancelled: t("purchases.status.cancelled"),
  };

  const { data: pos, isLoading } = useQuery({ queryKey: ["purchase-orders"], queryFn: () => api.get("/purchase-orders").then((r) => r.data as PO[]) });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then((r) => r.data as Supplier[]) });
  const { data: ingredients } = useQuery({ queryKey: ["ingredients-variants"], queryFn: () => api.get("/items/ingredients").then((r) => r.data as Ingredient[]) });
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: () => api.get("/units").then((r) => r.data as Unit[]) });
  const { data: detail } = useQuery({ queryKey: ["purchase-order", detailId], queryFn: () => api.get(`/purchase-orders/${detailId}`).then((r) => r.data as PO & { lines: POLine[] }), enabled: !!detailId });

  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";
  const supplierName = (id: string | null) => (id ? suppliers?.find((s) => s.id === id)?.name ?? "Supplier" : "—");
  const ingredientName = (vid: string) => ingredients?.find((i) => i.variantId === vid)?.itemName ?? "Item";
  const unitAbbr = (uid: string) => units?.find((u) => u.id === uid)?.abbreviation ?? "";

  const visiblePOs = (pos ?? []); // POs are business-wide; shown regardless of active location
  const noIngredients = (ingredients ?? []).length === 0;

  function openBuilder() {
    if (!activeLocationId && locations.length > 1) {
      toast({ title: t("purchases.locationToast.title"), description: t("purchases.locationToast.description"), variant: "destructive" });
      return;
    }
    setSupplierId("");
    setLines([]);
    setAdd({ variantId: "", quantity: "", unitId: "", unitCost: "" });
    setBuilderOpen(true);
  }
  function addLine() {
    if (!add.variantId || !add.quantity || !add.unitCost) return;
    setLines((prev) => [...prev, { variantId: add.variantId, description: ingredientName(add.variantId), quantity: add.quantity, unitId: add.unitId, unitCost: add.unitCost }]);
    setAdd({ variantId: "", quantity: "", unitId: "", unitCost: "" });
  }
  const builderTotal = lines.reduce((s, l) => s + parseFloat(l.quantity || "0") * parseFloat(l.unitCost || "0"), 0);

  // Pre-fill the builder from below-threshold ingredients at this location.
  const fromLowStock = useMutation({
    mutationFn: () =>
      api.get(`/inventory/reorder-suggestions?locationId=${activeLocationId}`).then(
        (r) => r.data as Array<{ variantId: string; itemName: string; unitId: string | null; suggestedQty: string; unitCost: string }>,
      ),
    onSuccess: (sugs) => {
      if (!sugs.length) { toast({ title: t("purchases.reorder.noneTitle"), description: t("purchases.reorder.noneDesc") }); return; }
      setSupplierId("");
      setLines(sugs.map((s) => ({ variantId: s.variantId, description: s.itemName, quantity: s.suggestedQty, unitId: s.unitId ?? "", unitCost: s.unitCost })));
      setAdd({ variantId: "", quantity: "", unitId: "", unitCost: "" });
      setBuilderOpen(true);
    },
    onError: (e) => toast({ title: t("purchases.reorder.couldnt"), description: errText(e), variant: "destructive" }),
  });

  function openFromLowStock() {
    if (!activeLocationId) {
      toast({ title: t("purchases.locationToast.title"), description: t("purchases.locationToast.description"), variant: "destructive" });
      return;
    }
    fromLowStock.mutate();
  }

  const createPO = useMutation({
    mutationFn: () =>
      api.post("/purchase-orders", {
        locationId: activeLocationId,
        supplierId: supplierId || null,
        lines: lines.map((l) => ({ variantId: l.variantId, description: l.description, quantity: l.quantity, unitId: l.unitId || null, unitCost: l.unitCost })),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); setBuilderOpen(false); setLines([]); toast({ title: t("purchases.toast.created"), variant: "success" }); },
    onError: (e) => toast({ title: t("purchases.toast.couldntCreate"), description: errText(e), variant: "destructive" }),
  });

  const receivePO = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${detailId}/receive`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-order", detailId] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      toast({ title: t("purchases.toast.received"), variant: "success" });
    },
    onError: (e) => toast({ title: t("purchases.toast.couldntReceive"), description: errText(e), variant: "destructive" }),
  });

  const updatePO = useMutation({
    mutationFn: () => api.patch(`/purchase-orders/${detailId}`, {
      supplierId: editForm.supplierId || null,
      notes: editForm.notes || null,
      expectedAt: editForm.expectedAt || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-order", detailId] });
      setIsEditing(false);
      toast({ title: t("purchases.toast.updated"), variant: "success" });
    },
    onError: (e) => toast({ title: t("purchases.toast.couldntUpdate"), description: errText(e), variant: "destructive" }),
  });

  const cancelPO = useMutation({
    mutationFn: () => api.delete(`/purchase-orders/${detailId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      setConfirmCancel(false);
      setDetailId(null);
      toast({ title: t("purchases.toast.cancelled"), variant: "success" });
    },
    onError: (e) => { setConfirmCancel(false); toast({ title: t("purchases.toast.couldntCancel"), description: errText(e), variant: "destructive" }); },
  });

  function startEdit() {
    setEditForm({
      supplierId: detail?.supplierId ?? "",
      expectedAt: detail?.expectedAt ? detail.expectedAt.split("T")[0]! : "",
      notes: detail?.notes ?? "",
    });
    setIsEditing(true);
  }

  const detailTotal = (detail?.lines ?? []).reduce((s, l) => s + parseFloat(l.lineTotal || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("purchases.title")}</h1>
          <p className="text-sm text-slate-500">{t("purchases.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={fromLowStock.isPending} onClick={openFromLowStock}>
            <Sparkles className="mr-1 h-4 w-4 text-indigo-500" /> {t("purchases.btn.fromLowStock")}
          </Button>
          <Button onClick={openBuilder}><Plus className="mr-1 h-4 w-4" /> {t("purchases.btn.new")}</Button>
        </div>
      </div>

      {isLoading ? null : visiblePOs.length === 0 ? (
        <GuidedEmptyState
          icon={Truck}
          title={noIngredients ? t("purchases.emptyState.noIngredients.title") : t("purchases.emptyState.hasIngredients.title")}
          description={noIngredients ? t("purchases.emptyState.noIngredients.description") : t("purchases.emptyState.hasIngredients.description")}
          actionLabel={noIngredients ? t("purchases.emptyState.noIngredients.actionLabel") : t("purchases.emptyState.hasIngredients.actionLabel")}
          actionHref={noIngredients ? "/dashboard/ingredients" : undefined}
          onAction={noIngredients ? undefined : openBuilder}
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("purchases.table.col.created")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("purchases.table.col.supplier")}</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">{t("purchases.table.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {visiblePOs.map((po) => (
                  <tr key={po.id} onClick={() => setDetailId(po.id)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatDate(po.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{supplierName(po.supplierId)}</td>
                    <td className="px-4 py-3 text-center"><Badge variant={statusVariant(po.status)}>{STATUS_LABEL[po.status] ?? po.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Builder */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("purchases.builderDialog.title")}</DialogTitle></DialogHeader>
          {noIngredients ? (
            <div className="py-6"><GuidedEmptyState icon={Truck} title={t("purchases.builderDialog.noIngredients.title")} description={t("purchases.builderDialog.noIngredients.description")} actionLabel={t("purchases.builderDialog.noIngredients.actionLabel")} actionHref="/dashboard/ingredients" /></div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>{t("purchases.builderDialog.label.supplier")}</Label>
                <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={t("purchases.builderDialog.supplier.none")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("purchases.builderDialog.supplier.none")}</SelectItem>
                    {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Lines */}
              <div className="rounded-lg border border-slate-200">
                {lines.length === 0 ? (
                  <p className="px-4 py-4 text-center text-sm text-slate-400">{t("purchases.builderDialog.lines.empty")}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {lines.map((l, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="flex-1 font-medium">{l.description}</span>
                        <span className="text-slate-500">{parseFloat(l.quantity)} {unitAbbr(l.unitId)} × {fmt(l.unitCost)}</span>
                        <span className="w-20 text-right font-medium">{fmt(parseFloat(l.quantity) * parseFloat(l.unitCost))}</span>
                        <button onClick={() => setLines((prev) => prev.filter((_, x) => x !== i))} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add-line row */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">{t("purchases.builderDialog.addLine.label.ingredient")}</Label>
                  <Select value={add.variantId} onValueChange={(v) => setAdd({ ...add, variantId: v })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder={t("purchases.builderDialog.addLine.placeholder.ingredient")} /></SelectTrigger>
                    <SelectContent>{(ingredients ?? []).map((i) => <SelectItem key={i.variantId} value={i.variantId}>{i.itemName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-16"><Label className="text-xs">{t("purchases.builderDialog.addLine.label.qty")}</Label><Input className="h-8" inputMode="decimal" value={add.quantity} onChange={(e) => setAdd({ ...add, quantity: e.target.value })} /></div>
                <div className="w-20">
                  <Label className="text-xs">{t("purchases.builderDialog.addLine.label.unit")}</Label>
                  <Select value={add.unitId || "none"} onValueChange={(v) => setAdd({ ...add, unitId: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{(units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.abbreviation}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-20"><Label className="text-xs">{t("purchases.builderDialog.addLine.label.unitCost")}</Label><Input className="h-8" inputMode="decimal" value={add.unitCost} onChange={(e) => setAdd({ ...add, unitCost: e.target.value })} /></div>
                <Button size="sm" variant="outline" className="h-8" onClick={addLine} disabled={!add.variantId || !add.quantity || !add.unitCost}><Plus className="h-3.5 w-3.5" /></Button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-500">{t("purchases.builderDialog.summary.total")}</span>
                <span className="text-lg font-bold">{fmt(builderTotal)}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBuilderOpen(false)}>{t("purchases.builderDialog.btn.cancel")}</Button>
                <Button disabled={lines.length === 0 || createPO.isPending} onClick={() => createPO.mutate()}>{createPO.isPending ? t("purchases.builderDialog.btn.saving") : t("purchases.builderDialog.btn.create")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) { setDetailId(null); setIsEditing(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? t("purchases.detailDialog.title.edit") : t("purchases.detailDialog.title")}
              {detail && !isEditing ? <Badge variant={statusVariant(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Badge> : null}
            </DialogTitle>
          </DialogHeader>
          {detail ? (
            isEditing ? (
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>{t("purchases.builderDialog.label.supplier")}</Label>
                  <Select value={editForm.supplierId || "none"} onValueChange={(v) => setEditForm({ ...editForm, supplierId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder={t("purchases.builderDialog.supplier.none")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("purchases.builderDialog.supplier.none")}</SelectItem>
                      {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("purchases.detailDialog.label.expectedAt")}</Label>
                  <Input type="date" value={editForm.expectedAt} onChange={(e) => setEditForm({ ...editForm, expectedAt: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("purchases.detailDialog.label.notes")}</Label>
                  <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder={t("purchases.detailDialog.placeholder.notes")} />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>{t("purchases.detailDialog.btn.back")}</Button>
                  <Button disabled={updatePO.isPending} onClick={() => updatePO.mutate()}>
                    {updatePO.isPending ? t("purchases.builderDialog.btn.saving") : t("purchases.detailDialog.btn.saveChanges")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="text-sm text-slate-500">{supplierName(detail.supplierId)}</div>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {(detail.lines ?? []).map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span>{parseFloat(l.quantity)}× {l.description}</span>
                      <span className="text-slate-600">{fmt(l.lineTotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold"><span>{t("purchases.detailDialog.summary.total")}</span><span>{fmt(detailTotal)}</span></div>
                {detail.status !== "received" && detail.status !== "cancelled" && (
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmCancel(true)}>
                      {t("purchases.detailDialog.btn.cancelOrder")}
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={startEdit}>
                        <Pencil className="mr-1 h-4 w-4" /> {t("purchases.detailDialog.btn.edit")}
                      </Button>
                      <Button disabled={receivePO.isPending} onClick={() => receivePO.mutate()}>
                        <Truck className="mr-1 h-4 w-4" /> {receivePO.isPending ? t("purchases.detailDialog.btn.receiving") : t("purchases.detailDialog.btn.receive")}
                      </Button>
                    </div>
                  </div>
                )}
                {detail.status === "received" && (
                  <Hint>{t("purchases.detailDialog.hint.received", { date: detail.receivedAt ? ` on ${formatDate(detail.receivedAt)}` : "" })}</Hint>
                )}
              </div>
            )
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">{t("purchases.detailDialog.loading")}</div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("purchases.detailDialog.confirmCancel.title")}
        description={t("purchases.detailDialog.confirmCancel.description")}
        confirmLabel={t("purchases.detailDialog.confirmCancel.confirm")}
        destructive
        loading={cancelPO.isPending}
        onConfirm={() => cancelPO.mutate()}
      />
    </div>
  );
}
