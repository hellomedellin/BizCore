import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_COLORS: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export function MeTimeOffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ requestType: "vacation" as const, startDate: "", endDate: "", notes: "" });

  const { data: requests } = useQuery({
    queryKey: ["me-time-off"],
    queryFn: () => api.get("/me/time-off-requests").then((r) => r.data),
  });

  const submit = useMutation({
    mutationFn: () => api.post("/me/time-off-requests", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me-time-off"] }); setOpen(false); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Time Off</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Request</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request Time Off</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <select value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value as any })}
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                  {["vacation", "sick", "personal", "unpaid"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>From</Label>
                  <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button disabled={!form.startDate || !form.endDate || submit.isPending} onClick={() => submit.mutate()}>Submit</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="space-y-2 pt-4">
          {!(requests ?? []).length && <p className="text-sm text-slate-400">No time-off requests yet.</p>}
          {(requests ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
              <div>
                <p className="font-medium text-sm capitalize">{r.requestType}</p>
                <p className="text-xs text-slate-500">{formatDate(r.startDate)} – {formatDate(r.endDate)}</p>
              </div>
              <Badge variant={STATUS_COLORS[r.status] ?? "secondary"}>{r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
