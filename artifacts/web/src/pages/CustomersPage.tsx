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
import { Plus, Search, BookUser } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

const EMPTY = { name: "", phone: "", email: "", notes: "" };

export function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => api.get("/customers").then((r) => r.data as Customer[]),
  });

  const filtered = (customers ?? []).filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";
  const payload = () => ({
    name: form.name.trim(),
    phone: form.phone || null,
    email: form.email || null,
    notes: form.notes || null,
  });

  const create = useMutation({
    mutationFn: () => api.post("/customers", payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setCreateOpen(false);
      setForm(EMPTY);
      toast({ title: "Customer added", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: () => api.patch(`/customers/${editing!.id}`, payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setEditing(null);
      toast({ title: "Saved", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: () => api.patch(`/customers/${editing!.id}`, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
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
  function openEdit(c: Customer) {
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" });
    setEditing(c);
  }

  function renderFields() {
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sarah Mitchell" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional — preferences, allergies…" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">Your regulars and their details.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add customer
        </Button>
      </div>

      {isLoading ? null : (customers ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={BookUser}
          title="No customers yet"
          description="Add regulars to keep their contact info and order history. You can also add a customer while taking an order."
          actionLabel="Add customer"
          onAction={openCreate}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => openEdit(c)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{c.email ?? "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
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
            <DialogTitle>Add customer</DialogTitle>
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
            <DialogTitle>Edit customer</DialogTitle>
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
        title={`Remove ${editing?.name ?? "this customer"}?`}
        description="They'll be hidden from your list. Past orders are kept."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
