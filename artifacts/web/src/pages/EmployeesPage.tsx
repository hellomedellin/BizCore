import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Search, Users } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roleId: string | null;
  primaryLocationId: string | null;
  hourlyRate: string | null;
}
interface Role { id: string; name: string }
interface Location { id: string; name: string }

const EMPTY = { name: "", email: "", phone: "", roleId: "", hourlyRate: "", primaryLocationId: "" };

export function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/employees").then((r) => r.data as Employee[]),
  });
  const { data: roles } = useQuery({ queryKey: ["employee-roles"], queryFn: () => api.get("/employee-roles").then((r) => r.data as Role[]) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then((r) => r.data as Location[]) });

  const filtered = (employees ?? []).filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  const roleName = (id: string | null) => (id ? roles?.find((r) => r.id === id)?.name ?? "—" : "—");
  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";
  const payload = () => ({
    name: form.name.trim(),
    email: form.email || null,
    phone: form.phone || null,
    roleId: form.roleId || null,
    hourlyRate: form.hourlyRate || null,
    primaryLocationId: form.primaryLocationId || null,
  });

  const create = useMutation({
    mutationFn: () => api.post("/employees", payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setCreateOpen(false);
      setForm(EMPTY);
      toast({ title: "Employee added", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: () => api.patch(`/employees/${editing!.id}`, payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditing(null);
      toast({ title: "Saved", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: () => api.patch(`/employees/${editing!.id}`, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
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
  function openEdit(e: Employee) {
    setForm({
      name: e.name,
      email: e.email ?? "",
      phone: e.phone ?? "",
      roleId: e.roleId ?? "",
      hourlyRate: e.hourlyRate ?? "",
      primaryLocationId: e.primaryLocationId ?? "",
    });
    setEditing(e);
  }

  function renderFields() {
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sofia Garcia" />
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={form.roleId || "none"} onValueChange={(v) => setForm({ ...form, roleId: v === "none" ? "" : v })}>
              <SelectTrigger>
                <SelectValue placeholder="No role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role</SelectItem>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Hourly rate</Label>
            <Input value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} placeholder="0.00" inputMode="decimal" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Primary location</Label>
          <Select value={form.primaryLocationId || "none"} onValueChange={(v) => setForm({ ...form, primaryLocationId: v === "none" ? "" : v })}>
            <SelectTrigger>
              <SelectValue placeholder="No location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No location</SelectItem>
              {(locations ?? []).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Hint>Where this person usually works. You can change it anytime.</Hint>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500">Your team and their roles.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add employee
        </Button>
      </div>

      {isLoading ? null : (employees ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={Users}
          title="No employees yet"
          description="Add your team so you can schedule shifts and track hours. Give each person a role and pay rate."
          actionLabel="Add employee"
          onAction={openCreate}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Phone</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Pay</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} onClick={() => openEdit(emp)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{emp.name}</td>
                    <td className="px-4 py-3 text-slate-500">{roleName(emp.roleId)}</td>
                    <td className="px-4 py-3 text-slate-500">{emp.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{emp.hourlyRate ? `${formatCurrency(emp.hourlyRate)}/hr` : "—"}</td>
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
            <DialogTitle>Add employee</DialogTitle>
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
            <DialogTitle>Edit employee</DialogTitle>
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
        title={`Remove ${editing?.name ?? "this employee"}?`}
        description="They'll be hidden from your team list. Past shifts and hours are kept."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
