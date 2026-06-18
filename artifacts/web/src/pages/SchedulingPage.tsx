import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { Plus, Calendar, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Shift {
  id: string;
  employeeId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  notes: string | null;
}
interface Employee { id: string; name: string; active?: boolean }
interface Location { id: string; name: string; active?: boolean }

const EMPTY = { employeeId: "", locationId: "", startTime: "", endTime: "", notes: "" };

export function SchedulingPage() {
  const t = useT();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [from] = useState(today);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts", from],
    queryFn: () => api.get(`/shifts?from=${from}T00:00:00Z`).then((r) => r.data as Shift[]),
  });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/employees?active=true").then((r) => r.data as Employee[]),
  });
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data as Location[]),
  });

  const activeEmployees = (employees ?? []).filter((e) => e.active !== false);
  const activeLocations = (locations ?? []).filter((l) => l.active !== false);
  const empName = (id: string) => employees?.find((e) => e.id === id)?.name ?? "—";
  const locName = (id: string) => locations?.find((l) => l.id === id)?.name ?? "—";

  const create = useMutation({
    mutationFn: () => api.post("/shifts", {
      ...form,
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      notes: form.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setCreateOpen(false);
      setForm(EMPTY);
      toast({ title: t("scheduling.toast.scheduled"), variant: "success" });
    },
    onError: (e: any) => toast({ title: t("scheduling.toast.couldntSchedule"), description: e?.response?.data?.error ?? t("common.error"), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/shifts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setDeleteTarget(null);
      toast({ title: t("scheduling.toast.removed"), variant: "success" });
    },
    onError: () => {
      setDeleteTarget(null);
      toast({ title: t("scheduling.toast.couldntRemove"), variant: "destructive" });
    },
  });

  const canSubmit = form.employeeId && form.locationId && form.startTime && form.endTime && !create.isPending;

  const noEmployees = !shiftsLoading && activeEmployees.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("scheduling.title")}</h1>
          <p className="text-sm text-slate-500">{t("scheduling.subtitle")}</p>
        </div>
        {!noEmployees && (
          <Button onClick={() => { setForm(EMPTY); setCreateOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> {t("scheduling.btn.scheduleShift")}
          </Button>
        )}
      </div>

      {noEmployees ? (
        <GuidedEmptyState
          icon={Calendar}
          title={t("scheduling.emptyState.noEmployees.title")}
          description={t("scheduling.emptyState.noEmployees.description")}
          actionLabel={t("scheduling.emptyState.noEmployees.actionLabel")}
          onAction={() => { window.location.href = "/dashboard/employees"; }}
        />
      ) : shiftsLoading ? null : (shifts ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={Calendar}
          title={t("scheduling.emptyState.noShifts.title")}
          description={t("scheduling.emptyState.noShifts.description")}
          actionLabel={t("scheduling.emptyState.noShifts.actionLabel")}
          onAction={() => { setForm(EMPTY); setCreateOpen(true); }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("scheduling.table.col.employee")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("scheduling.table.col.location")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("scheduling.table.col.start")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("scheduling.table.col.end")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("scheduling.table.col.notes")}</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {(shifts ?? []).map((shift) => (
                  <tr key={shift.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{empName(shift.employeeId)}</td>
                    <td className="px-4 py-3 text-slate-500">{locName(shift.locationId)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(shift.startTime)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(shift.endTime)}</td>
                    <td className="px-4 py-3 text-slate-400">{shift.notes || "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeleteTarget(shift)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Create shift dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("scheduling.createDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("scheduling.createDialog.label.employee")}</Label>
              <Select value={form.employeeId || "none"} onValueChange={(v) => setForm({ ...form, employeeId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("scheduling.createDialog.placeholder.employee")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("scheduling.createDialog.placeholder.employee")}</SelectItem>
                  {activeEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("scheduling.createDialog.label.location")}</Label>
              <Select value={form.locationId || "none"} onValueChange={(v) => setForm({ ...form, locationId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("scheduling.createDialog.placeholder.location")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("scheduling.createDialog.placeholder.location")}</SelectItem>
                  {activeLocations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("scheduling.createDialog.label.start")}</Label>
                <input
                  type="datetime-local"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("scheduling.createDialog.label.end")}</Label>
                <input
                  type="datetime-local"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("scheduling.createDialog.label.notes")}</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("scheduling.createDialog.placeholder.notes")} />
              <Hint>{t("scheduling.createDialog.hint.notes")}</Hint>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("scheduling.createDialog.btn.cancel")}</Button>
            <Button disabled={!canSubmit} onClick={() => create.mutate()}>
              {create.isPending ? t("scheduling.createDialog.btn.scheduling") : t("scheduling.createDialog.btn.schedule")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title={t("scheduling.deleteDialog.title")}
        description={deleteTarget ? `${empName(deleteTarget.employeeId)} on ${formatDateTime(deleteTarget.startTime)}` : ""}
        confirmLabel={t("scheduling.deleteDialog.confirmLabel")}
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
}
