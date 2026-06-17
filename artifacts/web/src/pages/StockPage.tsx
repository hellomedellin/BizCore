import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocationContext } from "@/hooks/useLocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { Warehouse, Carrot, Truck, Search } from "lucide-react";

interface Level {
  itemId: string;
  itemName: string;
  variantId: string;
  variantName: string;
  quantity: string;
  lowStockThreshold: string | null;
  unitId: string | null;
  unitAbbreviation: string | null;
  isLowStock: boolean;
}

export function StockPage() {
  const qc = useQueryClient();
  const { activeLocationId, locations, ready } = useLocationContext();
  const [search, setSearch] = useState("");
  const [counting, setCounting] = useState<Level | null>(null);
  const [count, setCount] = useState("");

  const { data: levels, isLoading } = useQuery({
    queryKey: ["stock-levels", activeLocationId],
    queryFn: () => api.get(`/inventory/levels?locationId=${activeLocationId}`).then((r) => r.data as Level[]),
    enabled: !!activeLocationId,
  });

  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";
  const setCountM = useMutation({
    mutationFn: () => {
      const current = parseFloat(counting!.quantity || "0");
      const target = parseFloat(count || "0");
      const delta = (target - current).toString();
      return api.post("/inventory/adjust", {
        variantId: counting!.variantId,
        locationId: activeLocationId,
        type: "adjust",
        quantityChange: delta,
        ...(counting!.unitId ? { unitId: counting!.unitId } : {}),
        notes: "Stock count",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setCounting(null);
      toast({ title: "Stock updated", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't update", description: errText(e), variant: "destructive" }),
  });

  function openCount(l: Level) {
    setCount(l.quantity ?? "0");
    setCounting(l);
  }

  // Stock is per-location — if "All locations" is selected with several locations, ask to pick one.
  if (ready && !activeLocationId && locations.length > 1) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
        <GuidedEmptyState
          icon={Warehouse}
          title="Pick a location"
          description="Stock is tracked per location. Choose a location from the switcher at the top to view and update its stock."
        />
      </div>
    );
  }

  const filtered = (levels ?? []).filter((l) => l.itemName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock</h1>
          <p className="text-sm text-slate-500">How much of each ingredient you have on hand.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/purchasing">
            <Truck className="mr-1 h-4 w-4" /> Receive delivery
          </Link>
        </Button>
      </div>

      {isLoading ? null : (levels ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={Carrot}
          title="No ingredients to stock yet"
          description="Stock is what you have on hand of each ingredient — and it's created by counting it or receiving a delivery. First, add the ingredients you want to track."
          actionLabel="Add an ingredient"
          actionHref="/dashboard/ingredients"
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search ingredients…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Ingredient</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">On hand</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.variantId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{l.itemName}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {parseFloat(l.quantity).toLocaleString()} {l.unitAbbreviation ?? ""}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {l.isLowStock ? <Badge variant="warning">Low</Badge> : <Badge variant="secondary">OK</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openCount(l)}>
                        Set count
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      No matches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!counting} onOpenChange={(o) => { if (!o) setCounting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set count — {counting?.itemName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Counted amount {counting?.unitAbbreviation ? `(${counting.unitAbbreviation})` : ""}</Label>
              <Input value={count} onChange={(e) => setCount(e.target.value)} inputMode="decimal" placeholder="0" autoFocus />
              <Hint>Enter what you actually have on hand right now — we'll record the adjustment.</Hint>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCounting(null)}>
                Cancel
              </Button>
              <Button disabled={setCountM.isPending} onClick={() => setCountM.mutate()}>
                {setCountM.isPending ? "Saving…" : "Save count"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
