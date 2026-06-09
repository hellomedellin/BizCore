import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CheckCircle, Upload } from "lucide-react";
import { formatDate } from "@/lib/utils";

type POLine = { description: string; quantity: string; unitCost: string };

const STATUS_COLORS: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  draft: "secondary",
  ai_processing: "warning",
  ai_complete: "warning",
  submitted: "secondary",
  received: "success",
  cancelled: "destructive",
};

export function PurchasingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invLocationId, setInvLocationId] = useState("");
  const [form, setForm] = useState({ locationId: "", supplierId: "", notes: "" });
  const [lines, setLines] = useState<POLine[]>([{ description: "", quantity: "1", unitCost: "0" }]);

  const { data: pos } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => api.get("/purchase-orders").then((r) => r.data),
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers").then((r) => r.data),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/purchase-orders", { ...form, lines }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); setOpen(false); },
  });

  const receive = useMutation({
    mutationFn: (id: string) => api.post(`/purchase-orders/${id}/receive`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  const uploadInvoice = useMutation({
    mutationFn: async () => {
      if (!invoiceFile || !invLocationId) return;
      const { data } = await api.post("/invoice-ai/upload-url", {
        locationId: invLocationId,
        filename: invoiceFile.name,
        contentType: invoiceFile.type,
      });
      await fetch(data.uploadUrl, { method: "PUT", body: invoiceFile, headers: { "Content-Type": invoiceFile.type } });
      await api.post("/invoice-ai/trigger", { purchaseOrderId: data.purchaseOrderId, s3Key: data.s3Key });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); setInvoiceOpen(false); setInvoiceFile(null); },
  });

  const addLine = () => setLines([...lines, { description: "", quantity: "1", unitCost: "0" }]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
        <div className="flex gap-2">
          <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="mr-1 h-4 w-4" /> Upload Invoice</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload Invoice for AI Processing</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Location</Label>
                  <select value={invLocationId} onChange={(e) => setInvLocationId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="">Select…</option>
                    {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Invoice File (PDF or image)</Label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setInvoiceOpen(false)}>Cancel</Button>
                  <Button disabled={!invoiceFile || !invLocationId || uploadInvoice.isPending} onClick={() => uploadInvoice.mutate()}>
                    {uploadInvoice.isPending ? "Uploading…" : "Upload & Process"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" /> New PO</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Location *</Label>
                    <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="">Select…</option>
                      {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                      <option value="">— Optional —</option>
                      {(suppliers ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Lines</Label>
                    <Button size="sm" variant="outline" onClick={addLine}><Plus className="h-3 w-3" /></Button>
                  </div>
                  {lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_80px_32px] gap-2">
                      <Input placeholder="Description" value={line.description} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, description: e.target.value } : l))} />
                      <Input placeholder="Qty" type="number" value={line.quantity} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                      <Input placeholder="Unit cost" type="number" value={line.unitCost} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, unitCost: e.target.value } : l))} />
                      <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button disabled={!form.locationId || create.isPending} onClick={() => create.mutate()}>Create PO</Button>
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
                <th className="px-4 py-3 text-left font-medium text-slate-600">ID</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Source</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {!(pos ?? []).length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No purchase orders.</td></tr>
              )}
              {(pos ?? []).map((po: any) => (
                <tr key={po.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs">#{po.id.slice(0, 8)}</td>
                  <td className="px-4 py-3"><Badge variant={STATUS_COLORS[po.status] ?? "secondary"}>{po.status.replace("_", " ")}</Badge></td>
                  <td className="px-4 py-3 capitalize text-slate-500">{po.source}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(po.createdAt)}</td>
                  <td className="px-4 py-3">
                    {(po.status === "ai_complete" || po.status === "draft") && (
                      <Button size="sm" variant="outline" onClick={() => receive.mutate(po.id)} disabled={receive.isPending}>
                        <CheckCircle className="mr-1 h-3 w-3" /> Receive
                      </Button>
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
