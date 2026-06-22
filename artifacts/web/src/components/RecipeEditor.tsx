import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { Plus, Trash2 } from "lucide-react";

interface Profile { id: string; outputItemId: string }
interface Line { id: string; lineType: string; resourceVariantId: string | null; quantity: string | null; unitId: string | null }
interface Ingredient { itemId: string; itemName: string; variantId: string; variantName: string; cost: string | null }
interface Unit { id: string; name: string; abbreviation: string }

// Inline recipe editor shown on a menu item: list the ingredients it consumes so
// selling the item auto-deducts stock. Optional, with a nudge. Shows live plate
// cost + margin so pricing isn't blind.
export function RecipeEditor({ itemId, itemName, price }: { itemId: string; itemName: string; price?: string | null }) {
  const qc = useQueryClient();
  const { fmt } = useCurrency();
  const [ingredientVariantId, setIngredientVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitId, setUnitId] = useState("");

  const { data: profiles } = useQuery({ queryKey: ["consumption-profiles"], queryFn: () => api.get("/consumption-profiles").then((r) => r.data as Profile[]) });
  const profile = (profiles ?? []).find((p) => p.outputItemId === itemId);
  const { data: detail } = useQuery({
    queryKey: ["consumption-profile", profile?.id],
    queryFn: () => api.get(`/consumption-profiles/${profile!.id}`).then((r) => r.data as { lines: Line[] }),
    enabled: !!profile?.id,
  });
  const { data: ingredients } = useQuery({ queryKey: ["ingredients-variants"], queryFn: () => api.get("/items/ingredients").then((r) => r.data as Ingredient[]) });
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: () => api.get("/units").then((r) => r.data as Unit[]) });

  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";
  const ingredientName = (vid: string | null) => ingredients?.find((i) => i.variantId === vid)?.itemName ?? "Ingredient";
  const ingredientCost = (vid: string | null) => ingredients?.find((i) => i.variantId === vid)?.cost ?? null;
  const unitAbbr = (uid: string | null) => units?.find((u) => u.id === uid)?.abbreviation ?? "";
  const resourceLines = (detail?.lines ?? []).filter((l) => l.lineType === "resource");

  // Live plate cost: Σ (line quantity × ingredient unit cost). Margin needs a price.
  const plateCost = resourceLines.reduce((sum, l) => {
    const c = parseFloat(ingredientCost(l.resourceVariantId) ?? "0");
    const q = parseFloat(l.quantity ?? "0");
    return sum + (Number.isFinite(c) && Number.isFinite(q) ? c * q : 0);
  }, 0);
  const priceNum = price ? parseFloat(price) : null;
  const hasCost = resourceLines.some((l) => ingredientCost(l.resourceVariantId));
  const marginPct = priceNum && priceNum > 0 && hasCost ? Math.round(((priceNum - plateCost) / priceNum) * 100) : null;

  const addLine = useMutation({
    mutationFn: async () => {
      let pid = profile?.id;
      if (!pid) {
        const created = await api.post("/consumption-profiles", { outputItemId: itemId, name: `${itemName} recipe` });
        pid = created.data.id as string;
      }
      await api.post(`/consumption-profiles/${pid}/lines`, { lineType: "resource", resourceVariantId: ingredientVariantId, quantity, unitId: unitId || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consumption-profiles"] });
      qc.invalidateQueries({ queryKey: ["consumption-profile"] });
      qc.invalidateQueries({ queryKey: ["menu-costing"] });
      setIngredientVariantId("");
      setQuantity("");
      setUnitId("");
      toast({ title: "Added to recipe", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't add", description: errText(e), variant: "destructive" }),
  });

  const removeLine = useMutation({
    mutationFn: (lineId: string) => api.delete(`/consumption-profiles/${profile!.id}/lines/${lineId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consumption-profile"] });
      qc.invalidateQueries({ queryKey: ["consumption-profiles"] });
    },
    onError: (e) => toast({ title: "Couldn't remove", description: errText(e), variant: "destructive" }),
  });

  const noIngredients = (ingredients ?? []).length === 0;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-sm font-medium text-slate-900">Recipe — what this uses</p>
      <Hint>Optional. Add the ingredients this item consumes — then selling it automatically subtracts them from stock.</Hint>

      {resourceLines.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-md border border-slate-100 bg-white">
          {resourceLines.map((l) => (
            <div key={l.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
              <span>{ingredientName(l.resourceVariantId)}</span>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">{l.quantity ? parseFloat(l.quantity) : ""} {unitAbbr(l.unitId)}</span>
                <button onClick={() => removeLine.mutate(l.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resourceLines.length > 0 && hasCost && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-white px-3 py-2 text-xs border border-slate-100">
          <span className="text-slate-500">Plate cost <span className="font-semibold text-slate-800">{fmt(plateCost)}</span></span>
          {priceNum != null && <span className="text-slate-500">Sells for <span className="font-semibold text-slate-800">{fmt(priceNum)}</span></span>}
          {marginPct != null && (
            <span className={`font-semibold ${marginPct >= 60 ? "text-emerald-600" : marginPct >= 30 ? "text-amber-600" : "text-red-600"}`}>
              {marginPct}% margin
            </span>
          )}
        </div>
      )}

      {noIngredients ? (
        <p className="text-xs text-slate-400">Add ingredients first (Ingredients tab) to build a recipe.</p>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select value={ingredientVariantId} onValueChange={setIngredientVariantId}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Ingredient" /></SelectTrigger>
              <SelectContent>
                {(ingredients ?? []).map((i) => <SelectItem key={i.variantId} value={i.variantId}>{i.itemName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input className="h-8 w-20" placeholder="Qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <div className="w-24">
            <Select value={unitId || "none"} onValueChange={(v) => setUnitId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Unit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {(units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.abbreviation}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" className="h-8" disabled={!ingredientVariantId || !quantity || addLine.isPending} onClick={() => addLine.mutate()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
