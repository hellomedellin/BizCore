import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus } from "lucide-react";

export function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adj, setAdj] = useState({ variantId: "", locationId: "", quantityChange: "", notes: "" });

  const { data: inventory } = useQuery({
    queryKey: ["inventory", search],
    queryFn: () => api.get(`/inventory${search ? `?search=${encodeURIComponent(search)}` : ""}`).then((r) => r.data),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
  });

  const adjust = useMutation({
    mutationFn: () => api.post("/inventory/adjust", adj),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setAdjustOpen(false); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Plus className="mr-1 h-4 w-4" /> Manual Adjustment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Manual Inventory Adjustment</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Variant ID</Label>
                <Input value={adj.variantId} onChange={(e) => setAdj({ ...adj, variantId: e.target.value })} placeholder="UUID" />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <select value={adj.locationId} onChange={(e) => setAdj({ ...adj, locationId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Select location…</option>
                  {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Quantity Change (+/-)</Label>
                <Input type="number" value={adj.quantityChange} onChange={(e) => setAdj({ ...adj, quantityChange: e.target.value })} placeholder="e.g. 10 or -5" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={adj.notes} onChange={(e) => setAdj({ ...adj, notes: e.target.value })} placeholder="Reason for adjustment" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
                <Button disabled={!adj.variantId || !adj.locationId || !adj.quantityChange || adjust.isPending} onClick={() => adjust.mutate()}>Apply</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search inventory…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Item / Variant</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Location</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Quantity</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Low Stock</th>
              </tr>
            </thead>
            <tbody>
              {!(inventory ?? []).length && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No inventory records.</td></tr>
              )}
              {(inventory ?? []).map((inv: any) => (
                <tr key={`${inv.variantId}-${inv.locationId}`} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{inv.variantName ?? inv.variantId.slice(0, 8)}</p>
                    <p className="text-xs text-slate-400">{inv.itemName}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{inv.locationName ?? inv.locationId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    <span className={parseFloat(inv.quantity) <= parseFloat(inv.reorderPoint ?? "0") ? "text-red-600" : ""}>
                      {parseFloat(inv.quantity).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400">{inv.reorderPoint ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
