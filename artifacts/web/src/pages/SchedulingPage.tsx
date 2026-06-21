import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus, Calendar, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Shift {
  id: string; employeeId: string; locationId: string;
  startTime: string; endTime: string; notes: string | null;
  employeeName: string | null; roleColor: string | null;
}
interface Employee {
  id: string; name: string; active?: boolean;
  roleId: string | null; primaryLocationId: string | null;
}
interface Role { id: string; name: string; color: string | null }
interface Location { id: string; name: string; active?: boolean }

const EMPTY_FORM = { employeeId: "", locationId: "", startTime: "", endTime: "", notes: "" };
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// ── Date helpers ──────────────────────────────────────────────────────────────

function getMondayOfWeek(offsetWeeks: number): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay(); // 0=Sun
  const daysToMonday = day === 0 ? 6 : day - 1;
  return new Date(now.getTime() - daysToMonday * 86_400_000 + offsetWeeks * 7 * 86_400_000);
}

function getWeekDates(offsetWeeks: number): Date[] {
  const monday = getMondayOfWeek(offsetWeeks);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86_400_000));
}

function formatShiftTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatWeekLabel(dates: Date[]): string {
  const from = dates[0]!;
  const to = dates[6]!;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(from)} – ${fmt(to)}, ${from.getFullYear()}`;
}

function toLocalDateStr(d: Date): string {
  // "YYYY-MM-DD" in local timezone
  return d.toLocaleDateString("en-CA");
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SchedulingPage() {
  const t = useT();
  const qc = useQueryClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Query with week range. The `to` filter uses startTime so shifts starting in
  // this week are included regardless of end time.
  const weekFrom = weekDates[0]!.toISOString();
  const weekToDate = new Date(weekDates[6]!);
  weekToDate.setHours(23, 59, 59, 999);
  const weekTo = weekToDate.toISOString();

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts", weekOffset],
    queryFn: () => api.get(`/shifts?from=${weekFrom}&to=${weekTo}`).then((r) => r.data as Shift[]),
  });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/employees?active=true").then((r) => r.data as Employee[]),
  });
  const { data: roles } = useQuery({
    queryKey: ["employee-roles"],
    queryFn: () => api.get("/employee-roles").then((r) => r.data as Role[]),
  });
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data as Location[]),
  });

  const activeEmployees = (employees ?? []).filter((e) => e.active !== false);
  const activeLocations = (locations ?? []).filter((l) => l.active !== false);
  const noEmployees = !shiftsLoading && activeEmployees.length === 0;

  // Role color lookup: prefer data already attached to shift, fall back to roles table.
  const roleColorMap = useMemo(
    () => new Map((roles ?? []).map((r) => [r.id, r.color ?? "#6366f1"])),
    [roles],
  );
  function empColor(emp: Employee): string {
    return roleColorMap.get(emp.roleId ?? "") ?? "#94a3b8";
  }

  // Shifts organised by "employeeId:YYYY-MM-DD" for O(1) cell lookup.
  const shiftsByEmpDay = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts ?? []) {
      const dateStr = toLocalDateStr(new Date(s.startTime));
      const key = `${s.employeeId}:${dateStr}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return m;
  }, [shifts]);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const create = useMutation({
    mutationFn: () => api.post("/shifts", {
      ...form,
      startTime: new Date(form.startTime).toISOString(),
      endTime:   new Date(form.endTime).toISOString(),
      notes: form.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
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
    onError: () => { setDeleteTarget(null); toast({ title: t("scheduling.toast.couldntRemove"), variant: "destructive" }); },
  });

  const generateWeek = useMutation({
    mutationFn: () => api.post("/shifts/generate-week", {
      weekStart: toLocalDateStr(weekDates[0]!),
      utcOffsetMinutes: new Date().getTimezoneOffset(),
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      const { created } = r.data as { created: number; skipped: number };
      toast({
        title: created === 0
          ? t("scheduling.toast.nothingToGenerate")
          : t("scheduling.toast.generated", { count: created }),
        variant: created === 0 ? "default" : "success",
      });
    },
    onError: (e: any) => toast({ title: t("scheduling.toast.couldntGenerate"), description: e?.response?.data?.error, variant: "destructive" }),
  });

  // ── Cell click → pre-fill create dialog ────────────────────────────────────

  function openCreateForCell(emp: Employee, date: Date) {
    const dateStr = toLocalDateStr(date);
    setForm({
      employeeId: emp.id,
      locationId: emp.primaryLocationId ?? (activeLocations[0]?.id ?? ""),
      startTime: `${dateStr}T09:00`,
      endTime:   `${dateStr}T17:00`,
      notes: "",
    });
    setCreateOpen(true);
  }

  const canSubmit = form.employeeId && form.locationId && form.startTime && form.endTime && !create.isPending;
  const isToday = (d: Date) => toLocalDateStr(d) === toLocalDateStr(new Date());

  // ── Render ──────────────────────────────────────────────────────────────────

  if (noEmployees) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("scheduling.title")}</h1>
          <p className="text-sm text-slate-500">{t("scheduling.subtitle")}</p>
        </div>
        <GuidedEmptyState
          icon={Calendar}
          title={t("scheduling.emptyState.noEmployees.title")}
          description={t("scheduling.emptyState.noEmployees.description")}
          actionLabel={t("scheduling.emptyState.noEmployees.actionLabel")}
          onAction={() => { window.location.href = "/dashboard/employees"; }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("scheduling.title")}</h1>
          <p className="text-sm text-slate-500">{t("scheduling.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={generateWeek.isPending}
            onClick={() => generateWeek.mutate()}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            {generateWeek.isPending ? t("scheduling.btn.generating") : t("scheduling.btn.generateDefaults")}
          </Button>
          <Button size="sm" onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> {t("scheduling.btn.scheduleShift")}
          </Button>
        </div>
      </div>

      {/* ── Week navigator ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800 min-w-[200px] text-center">
          {formatWeekLabel(weekDates)}
        </span>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)} className="text-xs text-indigo-600 hover:underline ml-1">
            {t("scheduling.btn.thisWeek")}
          </button>
        )}
      </div>

      {/* ── Calendar grid ── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              {/* Employee column header */}
              <th className="w-36 px-3 py-3 text-left border-b border-slate-200 border-r border-slate-100">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t("scheduling.calendar.team")}</span>
              </th>
              {weekDates.map((date, i) => (
                <th key={i} className={cn(
                  "px-2 py-3 text-center border-b border-slate-200 w-[calc((100%-9rem)/7)]",
                  isToday(date) && "bg-indigo-50",
                )}>
                  <div className={cn("text-xs font-semibold uppercase tracking-wide", isToday(date) ? "text-indigo-500" : "text-slate-400")}>
                    {DAY_SHORT[i]}
                  </div>
                  <div className={cn(
                    "mt-0.5 mx-auto w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold",
                    isToday(date) ? "bg-indigo-600 text-white" : "text-slate-800",
                  )}>
                    {date.getDate()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map((emp, ei) => {
              const color = empColor(emp);
              return (
                <tr key={emp.id} className={cn("border-b border-slate-100 last:border-0", ei % 2 === 1 && "bg-slate-50/50")}>
                  {/* Employee name cell */}
                  <td className="px-3 py-2 border-r border-slate-100 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-slate-700 truncate" title={emp.name}>
                        {emp.name.split(" ")[0]}
                      </span>
                    </div>
                  </td>
                  {/* Day cells */}
                  {weekDates.map((date, di) => {
                    const dateStr = toLocalDateStr(date);
                    const cellShifts = shiftsByEmpDay.get(`${emp.id}:${dateStr}`) ?? [];
                    return (
                      <td
                        key={di}
                        className={cn(
                          "px-1.5 py-1.5 align-top min-h-[52px] h-14 transition-colors",
                          isToday(date) && "bg-indigo-50/40",
                          !cellShifts.length && "group cursor-pointer hover:bg-slate-100/80",
                        )}
                        onClick={() => !cellShifts.length && openCreateForCell(emp, date)}
                      >
                        {cellShifts.length > 0 ? (
                          <div className="space-y-1">
                            {cellShifts.map((s) => {
                              const c = s.roleColor ?? color;
                              return (
                                <div
                                  key={s.id}
                                  className="rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity select-none"
                                  style={{
                                    backgroundColor: `${c}18`,
                                    borderLeft: `3px solid ${c}`,
                                    color: c,
                                  }}
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                                  title={`${formatShiftTime(s.startTime)} – ${formatShiftTime(s.endTime)}`}
                                >
                                  <div className="font-semibold leading-tight">{formatShiftTime(s.startTime)}</div>
                                  <div className="opacity-70 leading-tight">{formatShiftTime(s.endTime)}</div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="h-4 w-4 text-slate-400" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Role legend ── */}
      {(roles ?? []).length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
          {(roles ?? []).map((r) => (
            <span key={r.id} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: r.color ?? "#6366f1" }} />
              {r.name}
            </span>
          ))}
        </div>
      )}

      {/* ── Create shift dialog ── */}
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
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: empColor(e) }} />
                        {e.name}
                      </span>
                    </SelectItem>
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
                  {activeLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
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
        description={deleteTarget
          ? `${deleteTarget.employeeName ?? "—"} · ${formatShiftTime(deleteTarget.startTime)} – ${formatShiftTime(deleteTarget.endTime)}`
          : ""}
        confirmLabel={t("scheduling.deleteDialog.confirmLabel")}
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
}
