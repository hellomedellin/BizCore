import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocationContext } from "@/hooks/useLocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Trash2, Truck } from "lucide-react";

interface PO { id: string; supplierId: string | null; status: string; expectedAt: string | null; receivedAt: string | null; createdAt: string }
interface POLine { id: string; description: string; quantity: string; unitCost: string; lineTotal: string }
interface Supplier { id: string; name: string }
interface Ingredient { itemId: string; itemName: string; variantId: string; variantName: string }
interface Unit { id: string; name: string; abbreviation: string }
interface BuilderLine { variantId: string; description: string; quantity: string; unitId: string; unitCost: string }

const STATUS_LABEL: Record<string, string> = { draft: "Draft", ai_processing: "Processing", ai_complete: "Review", submitted: "Submitted", received: "Received", cancelled: "Cancelled" };
const statusVariant = (s: string): "success" | "secondary" | "warning" => (s === "received" ? "success" : s === "cancelled" ? "secondary" : "warning");

export function PurchasesPage() {
  const qc = useQueryClient();
  const { activeLocationId, locations } = useLocationContext();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<BuilderLine[]>([]);
  const [add, setAdd] = useState({ variantId: "", quantity: "", unitId: "", unitCost: "" });
  const [detailId, setDetailId] = useState<string | null>(null);

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
      toast({ title: "Choose a location", description: "Pick a location at the top before creating a purchase.", variant: "destructive" });
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

  const createPO = useMutation({
    mutationFn: () =>
      api.post("/purchase-orders", {
        locationId: activeLocationId,
        supplierId: supplierId || null,
        lines: lines.map((l) => ({ variantId: l.variantId, description: l.description, quantity: l.quantity, unitId: l.unitId || null, unitCost: l.unitCost })),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); setBuilderOpen(false); setLines([]); toast({ title: "Purchase created", variant: "success" }); },
    onError: (e) => toast({ title: "Couldn't create", description: errText(e), variant: "destructive" }),
  });

  const receivePO = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${detailId}/receive`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-order", detailId] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      toast({ title: "Received — stock updated", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't receive", description: errText(e), variant: "destructive" }),
  });

  const detailTotal = (detail?.lines ?? []).reduce((s, l) => s + parseFloat(l.lineTotal || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchases</h1>
          <p className="text-sm text-slate-500">Order from suppliers and receive deliveries — receiving adds to your stock.</p>
        </div>
        <Button onClick={openBuilder}><Plus className="mr-1 h-4 w-4" /> New purchase</Button>
      </div>

      {isLoading ? null : visiblePOs.length === 0 ? (
        <GuidedEmptyState
          icon={Truck}
          title="No purchases yet"
          description={noIngredients ? "Add ingredients and a supplier first, then create a purchase to bring stock in." : "Create a purchase to order ingredients from a supplier. When it arrives, receive it and your stock goes up."}
          actionLabel={noIngredients ? "Add an ingredient" : "New purchase"}
          actionHref={noIngredients ? "/dashboard/ingredients" : undefined}
          onAction={noIngredients ? undefined : openBuilder}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Supplier</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
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
          <DialogHeader><DialogTitle>New purchase</DialogTitle></DialogHeader>
          {noIngredients ? (
            <div className="py-6"><GuidedEmptyState icon={Truck} title="No ingredients yet" description="Add the ingredients you buy on the Ingredients tab first." actionLabel="Go to Ingredients" actionHref="/dashboard/ingredients" /></div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="No supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supplier</SelectItem>
                    {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Lines */}
              <div className="rounded-lg border border-slate-200">
                {lines.length === 0 ? (
                  <p className="px-4 py-4 text-center text-sm text-slate-400">Add the items you're ordering below.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {lines.map((l, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="flex-1 font-medium">{l.description}</span>
                        <span className="text-slate-500">{parseFloat(l.quantity)} {unitAbbr(l.unitId)} × {formatCurrency(l.unitCost)}</span>
                        <span className="w-20 text-right font-medium">{formatCurrency(parseFloat(l.quantity) * parseFloat(l.unitCost))}</span>
                        <button onClick={() => setLines((prev) => prev.filter((_, x) => x !== i))} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add-line row */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Ingredient</Label>
                  <Select value={add.variantId} onValueChange={(v) => setAdd({ ...add, variantId: v })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Pick…" /></SelectTrigger>
                    <SelectContent>{(ingredients ?? []).map((i) => <SelectItem key={i.variantId} value={i.variantId}>{i.itemName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-16"><Label className="text-xs">Qty</Label><Input className="h-8" inputMode="decimal" value={add.quantity} onChange={(e) => setAdd({ ...add, quantity: e.target.value })} /></div>
                <div className="w-20">
                  <Label className="text-xs">Unit</Label>
                  <Select value={add.unitId || "none"} onValueChange={(v) => setAdd({ ...add, unitId: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">—</SelectItem>{(units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.abbreviation}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-20"><Label className="text-xs">Unit cost</Label><Input className="h-8" inputMode="decimal" value={add.unitCost} onChange={(e) => setAdd({ ...add, unitCost: e.target.value })} /></div>
                <Button size="sm" variant="outline" className="h-8" onClick={addLine} disabled={!add.variantId || !add.quantity || !add.unitCost}><Plus className="h-3.5 w-3.5" /></Button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-lg font-bold">{formatCurrency(builderTotal)}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
                <Button disabled={lines.length === 0 || createPO.isPending} onClick={() => createPO.mutate()}>{createPO.isPending ? "Saving…" : "Create purchase"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Purchase {detail ? <Badge variant={statusVariant(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Badge> : null}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-slate-500">{supplierName(detail.supplierId)}</div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {(detail.lines ?? []).map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{parseFloat(l.quantity)}× {l.description}</span>
                    <span className="text-slate-600">{formatCurrency(l.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold"><span>Total</span><span>{formatCurrency(detailTotal)}</span></div>
              {detail.status !== "received" && detail.status !== "cancelled" && (
                <div className="flex justify-end">
                  <Button disabled={receivePO.isPending} onClick={() => receivePO.mutate()}>
                    <Truck className="mr-1 h-4 w-4" /> {receivePO.isPending ? "Receiving…" : "Receive — add to stock"}
                  </Button>
                </div>
              )}
              {detail.status === "received" && <Hint>Received{detail.receivedAt ? ` on ${formatDate(detail.receivedAt)}` : ""}. Stock was updated.</Hint>}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
