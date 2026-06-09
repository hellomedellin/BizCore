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

export function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", roleId: "", hourlyRate: "", primaryLocationId: "" });

  const { data: employees } = useQuery({
    queryKey: ["employees", search],
    queryFn: () => api.get(`/employees${search ? `?search=${encodeURIComponent(search)}` : ""}`).then((r) => r.data),
  });

  const { data: roles } = useQuery({
    queryKey: ["employee-roles"],
    queryFn: () => api.get("/employee-roles").then((r) => r.data),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/employees", { ...form, roleId: form.roleId || null, primaryLocationId: form.primaryLocationId || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); setOpen(false); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Add Employee</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Employee</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="">— No role —</option>
                    {(roles ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Hourly Rate</Label>
                  <Input type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Primary Location</Label>
                <select value={form.primaryLocationId} onChange={(e) => setForm({ ...form, primaryLocationId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">— Select location —</option>
                  {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
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
            <Input className="pl-9" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Role</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Hourly Rate</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {!(employees ?? []).length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No employees found.</td></tr>
              )}
              {(employees ?? []).map((emp: any) => (
                <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-slate-500">{emp.roleName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{emp.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{emp.hourlyRate ? `$${emp.hourlyRate}/hr` : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={emp.active ? "success" : "secondary"}>{emp.active ? "Active" : "Inactive"}</Badge>
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
