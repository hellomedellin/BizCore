import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";

const ITEM_TYPES = ["product", "resource", "service", "bundle"];

export function ItemsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "product", sku: "", description: "", categoryId: "" });

  const { data: items } = useQuery({
    queryKey: ["items", search],
    queryFn: () => api.get(`/items${search ? `?search=${encodeURIComponent(search)}` : ""}`).then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post("/items", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["items"] }); setOpen(false); setForm({ name: "", type: "product", sku: "", description: "", categoryId: "" }); },
  });

  const typeColors: Record<string, "default" | "secondary" | "success" | "warning"> = {
    product: "default",
    resource: "warning",
    service: "success",
    bundle: "secondary",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Items</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Add Item</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Item</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Coffee Beans" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">— No category —</option>
                  {(categories ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!form.name || create.isPending} onClick={() => create.mutate(form)}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Active</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">No items found.</td></tr>
              )}
              {(items ?? []).map((item: any) => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3"><Badge variant={typeColors[item.type] ?? "secondary"}>{item.type}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{item.sku || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${item.active ? "text-green-600" : "text-red-500"}`}>{item.active ? "Active" : "Inactive"}</span>
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
