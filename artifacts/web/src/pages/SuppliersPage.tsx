import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";

export function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", email: "", address: "", notes: "" });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: () => api.get(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ""}`).then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/suppliers", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setOpen(false); setForm({ name: "", contactName: "", phone: "", email: "", address: "", notes: "" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Add Supplier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Supplier</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!form.name || create.isPending} onClick={() => create.mutate()}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Phone</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {!(suppliers ?? []).length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No suppliers found.</td></tr>
              )}
              {(suppliers ?? []).map((s: any) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.contactName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{s.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={s.active ? "success" : "secondary"}>{s.active ? "Active" : "Inactive"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
