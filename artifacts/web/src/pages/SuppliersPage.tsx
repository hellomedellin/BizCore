import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Tag } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

const EMPTY = { name: "", contactName: "", phone: "", email: "", address: "", notes: "" };

export function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers").then((r) => r.data as Supplier[]),
  });

  const filtered = (suppliers ?? []).filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";
  const payload = () => ({
    name: form.name.trim(),
    contactName: form.contactName || null,
    phone: form.phone || null,
    email: form.email || null,
    address: form.address || null,
    notes: form.notes || null,
  });

  const create = useMutation({
    mutationFn: () => api.post("/suppliers", payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setCreateOpen(false);
      setForm(EMPTY);
      toast({ title: "Supplier added", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: () => api.patch(`/suppliers/${editing!.id}`, payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setEditing(null);
      toast({ title: "Saved", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: () => api.patch(`/suppliers/${editing!.id}`, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setConfirmDelete(false);
      setEditing(null);
      toast({ title: "Removed", variant: "success" });
    },
    onError: (e) => {
      setConfirmDelete(false);
      toast({ title: "Couldn't remove", description: errText(e), variant: "destructive" });
    },
  });

  function openCreate() {
    setForm(EMPTY);
    setCreateOpen(true);
  }
  function openEdit(s: Supplier) {
    setForm({
      name: s.name,
      contactName: s.contactName ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    });
    setEditing(s);
  }

  function renderFields() {
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Roast Republic" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Contact name</Label>
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional — payment terms, what they supply…" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500">The businesses you buy ingredients and supplies from.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add supplier
        </Button>
      </div>

      {isLoading ? null : (suppliers ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={Tag}
          title="No suppliers yet"
          description="Add the vendors you buy from. You'll pick a supplier when you create a purchase (a delivery) to restock ingredients."
          actionLabel="Add supplier"
          onAction={openCreate}
        />
      ) : (
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
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} onClick={() => openEdit(s)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.contactName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{s.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{s.email ?? "—"}</td>
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

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
          </DialogHeader>
          {renderFields()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Saving…" : "Add"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit (click a row) */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit supplier</DialogTitle>
          </DialogHeader>
          {renderFields()}
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
              Remove
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button disabled={!form.name.trim() || update.isPending} onClick={() => update.mutate()}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Remove ${editing?.name ?? "this supplier"}?`}
        description="They'll be hidden from your list. Past purchases are kept."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
