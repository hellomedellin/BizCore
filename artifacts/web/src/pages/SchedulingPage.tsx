import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export function SchedulingPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [from] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ employeeId: "", locationId: "", startTime: "", endTime: "", notes: "" });

  const { data: shifts } = useQuery({
    queryKey: ["shifts"],
    queryFn: () => api.get(`/shifts?from=${from}T00:00:00Z`).then((r) => r.data),
  });

  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/employees?active=true").then((r) => r.data),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post("/shifts", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); setOpen(false); },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/shifts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Scheduling</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Schedule Shift</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule a Shift</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Employee *</Label>
                <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Select…</option>
                  {(employees ?? []).map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Location *</Label>
                <select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  <option value="">Select…</option>
                  {(locations ?? []).map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start *</Label>
                  <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>End *</Label>
                  <input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!form.employeeId || !form.locationId || !form.startTime || !form.endTime || create.isPending} onClick={() => create.mutate()}>Schedule</Button>
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
                <th className="px-4 py-3 text-left font-medium text-slate-600">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Location</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Start</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">End</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {!(shifts ?? []).length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No upcoming shifts.</td></tr>
              )}
              {(shifts ?? []).map((shift: any) => (
                <tr key={shift.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">{shift.employeeId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-500">{shift.locationId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(shift.startTime)}</td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(shift.endTime)}</td>
                  <td className="px-4 py-3 text-slate-400">{shift.notes || "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => del.mutate(shift.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
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
