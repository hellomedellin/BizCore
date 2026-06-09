import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

type ProfileLine = { lineType: "resource" | "labor"; resourceVariantId: string; quantity: string; laborMinutes: string };

export function ConsumptionProfilesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ outputItemId: "", name: "", outputVariantId: "" });
  const [lines, setLines] = useState<ProfileLine[]>([{ lineType: "resource", resourceVariantId: "", quantity: "1", laborMinutes: "" }]);

  const { data: profiles } = useQuery({
    queryKey: ["consumption-profiles"],
    queryFn: () => api.get("/consumption-profiles").then((r) => r.data),
  });

  const { data: items } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.get("/items").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/consumption-profiles", {
      ...form,
      outputVariantId: form.outputVariantId || null,
      lines: lines.map((l) => ({
        lineType: l.lineType,
        resourceVariantId: l.lineType === "resource" ? l.resourceVariantId || null : null,
        quantity: l.lineType === "resource" ? l.quantity : null,
        laborMinutes: l.lineType === "labor" ? parseInt(l.laborMinutes) || null : null,
      })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["consumption-profiles"] }); setOpen(false); },
  });

  const addLine = (type: "resource" | "labor") => setLines([...lines, { lineType: type, resourceVariantId: "", quantity: "1", laborMinutes: "" }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Consumption Profiles</h1>
          <p className="text-sm text-slate-500 mt-1">Define what resources are consumed when an item is sold or produced.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> New Profile</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>New Consumption Profile</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Output Item *</Label>
                <select value={form.outputItemId} onChange={(e) => setForm({ ...form, outputItemId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Select item…</option>
                  {(items ?? []).map((it: any) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Profile Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard, Large Size" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Resource Lines</Label>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => addLine("resource")}>+ Resource</Button>
                    <Button size="sm" variant="outline" onClick={() => addLine("labor")}>+ Labor</Button>
                  </div>
                </div>
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Badge variant={line.lineType === "resource" ? "default" : "warning"} className="shrink-0">{line.lineType}</Badge>
                    {line.lineType === "resource" ? (
                      <>
                        <Input placeholder="Variant ID" className="flex-1" value={line.resourceVariantId} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, resourceVariantId: e.target.value } : l))} />
                        <Input placeholder="Qty" className="w-20" value={line.quantity} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, quantity: e.target.value } : l))} />
                      </>
                    ) : (
                      <Input placeholder="Labor minutes" className="flex-1" value={line.laborMinutes} onChange={(e) => setLines(lines.map((l, idx) => idx === i ? { ...l, laborMinutes: e.target.value } : l))} />
                    )}
                    <Button size="icon" variant="ghost" onClick={() => removeLine(i)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!form.outputItemId || create.isPending} onClick={() => create.mutate()}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Profile Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Output Item</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Variant-Specific</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Active</th>
              </tr>
            </thead>
            <tbody>
              {!(profiles ?? []).length && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No profiles yet.</td></tr>
              )}
              {(profiles ?? []).map((p: any) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{p.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{p.outputItemId.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    {p.outputVariantId ? <Badge variant="secondary">Variant</Badge> : <span className="text-slate-400 text-xs">All variants</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={p.active ? "success" : "secondary"}>{p.active ? "Active" : "Inactive"}</Badge>
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
