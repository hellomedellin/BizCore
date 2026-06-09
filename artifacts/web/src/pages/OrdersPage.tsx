import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";

type OrderLine = { variantId: string; name: string; quantity: string; unitPrice: string };

const STATUS_COLORS: Record<string, "default" | "secondary" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  confirmed: "secondary",
  in_progress: "secondary",
  ready: "default",
  completed: "success",
  cancelled: "destructive",
};

export function OrdersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [locationId, setLocationId] = useState("");
  const [orderType, setOrderType] = useState("retail");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([{ variantId: "", name: "", quantity: "1", unitPrice: "0" }]);

  const { data: orders } = useQuery({
    queryKey: ["orders", statusFilter],
    queryFn: () => api.get(`/orders${statusFilter ? `?status=${statusFilter}` : ""}`).then((r) => r.data),
    refetchInterval: 10_000,
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
  });

  const createOrder = useMutation({
    mutationFn: () => api.post("/orders", { locationId, orderType, notes, lines }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); setOpen(false); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const addLine = () => setLines([...lines, { variantId: "", name: "", quantity: "1", unitPrice: "0" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((s, l) => s + parseFloat(l.quantity || "0") * parseFloat(l.unitPrice || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">All statuses</option>
            {["pending","confirmed","in_progress","ready","completed","cancelled"].map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" /> New Order</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New Order</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Location *</Label>
                    <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="">Select…</option>
                      {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Order Type</Label>
                    <select value={orderType} onChange={(e) => setOrderType(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      {["retail","dine_in","pickup","delivery","service"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Order Lines</Label>
                    <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3" /></Button>
                  </div>
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_80px_32px] gap-2">
                      <Input placeholder="Item name" value={line.name} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, name: e.target.value } : l))} />
                      <Input placeholder="Qty" type="number" value={line.quantity} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                      <Input placeholder="Price" type="number" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, unitPrice: e.target.value } : l))} />
                      <Button size="icon" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                    </div>
                  ))}
                  <p className="text-right text-sm font-semibold">Subtotal: {formatCurrency(subtotal)}</p>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button disabled={!locationId || !lines.every((l) => l.name) || createOrder.isPending} onClick={() => createOrder.mutate()}>Create Order</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Order</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Total</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {!(orders ?? []).length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No orders found.</td></tr>
              )}
              {(orders ?? []).map((order: any) => (
                <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 capitalize">{order.orderType.replace("_", " ")}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_COLORS[order.status] ?? "secondary"}>{order.status}</Badge></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(order.total, order.currencyCode)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(order.createdAt)}</td>
                  <td className="px-4 py-3">
                    {order.status !== "completed" && order.status !== "cancelled" && (
                      <select
                        className="h-7 rounded border border-slate-200 bg-white px-2 text-xs"
                        defaultValue=""
                        onChange={(e) => e.target.value && updateStatus.mutate({ id: order.id, status: e.target.value })}
                      >
                        <option value="">Move to…</option>
                        {["confirmed","in_progress","ready","completed","cancelled"]
                          .filter((s) => s !== order.status)
                          .map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
