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
import { ChevronLeft, ChevronRight, Plus, Calendar, Sparkles, UmbrellaOff, Pencil } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Shift {
  id: string; employeeId: string; locationId: string;
  startTime: string; endTime: string; notes: string | null;
  employeeName: string | null; roleColor: string | null;
}
interface TimeOffRequest {
  id: string; employeeId: string;
  requestType: "vacation" | "sick" | "personal" | "unpaid";
  startDate: string; endDate: string; notes: string | null;
}
interface Employee {
  id: string; name: string; active?: boolean;
  roleId: string | null; primaryLocationId: string | null;
}
interface Role { id: string; name: string; color: string | null }
interface Location { id: string; name: string; active?: boolean }

const EMPTY_SHIFT_FORM = { employeeId: "", locationId: "", startTime: "", endTime: "", notes: "" };
const EMPTY_TIME_OFF_FORM = { employeeId: "", requestType: "vacation" as const, startDate: "", endDate: "", notes: "" };
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Time-off visual style per type
const TIME_OFF_STYLE: Record<string, { color: string; label: string }> = {
  vacation: { color: "#f59e0b", label: "" },
  sick:     { color: "#ef4444", label: "" },
  personal: { color: "#3b82f6", label: "" },
  unpaid:   { color: "#94a3b8", label: "" },
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function getMondayOfWeek(offsetWeeks: number): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const day = now.getDay();
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

function toISOLocal(dt: string): string {
  // datetime-local value → ISO string
  return new Date(dt).toISOString();
}

function toDateTimeLocal(iso: string): string {
  // ISO string → datetime-local value (YYYY-MM-DDTHH:MM)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWeekLabel(dates: Date[]): string {
  const from = dates[0]!;
  const to = dates[6]!;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(from)} – ${fmt(to)}, ${from.getFullYear()}`;
}

function toLocalDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

// Safe YYYY-MM-DD → local midnight (avoids UTC-offset day-shift)
function parseDateStr(s: string): Date {
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(y!, mo! - 1, d!);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SchedulingPage() {
  const t = useT();
  const qc = useQueryClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  // Shift dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [shiftForm, setShiftForm] = useState(EMPTY_SHIFT_FORM);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editShiftForm, setEditShiftForm] = useState({ startTime: "", endTime: "", notes: "" });
  const [confirmDeleteShift, setConfirmDeleteShift] = useState(false);

  // Time-off dialogs
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState(EMPTY_TIME_OFF_FORM);
  const [deleteTimeOff, setDeleteTimeOff] = useState<TimeOffRequest | null>(null);

  // Query bounds
  const weekFrom = weekDates[0]!.toISOString();
  const weekToDate = new Date(weekDates[6]!);
  weekToDate.setHours(23, 59, 59, 999);
  const weekTo = weekToDate.toISOString();
  const weekFromDate = toLocalDateStr(weekDates[0]!);
  const weekToDateStr = toLocalDateStr(weekDates[6]!);

  const { data: shifts, isLoading: shiftsLoading } = useQuery({
    queryKey: ["shifts", weekOffset],
    queryFn: () => api.get(`/shifts?from=${weekFrom}&to=${weekTo}`).then((r) => r.data as Shift[]),
  });
  const { data: timeOffRequests } = useQuery({
    queryKey: ["time-off", weekOffset],
    queryFn: () => api.get(`/time-off-requests?from=${weekFromDate}&to=${weekToDateStr}`).then((r) => r.data as TimeOffRequest[]),
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

  const roleColorMap = useMemo(
    () => new Map((roles ?? []).map((r) => [r.id, r.color ?? "#6366f1"])),
    [roles],
  );
  function empColor(emp: Employee): string {
    return roleColorMap.get(emp.roleId ?? "") ?? "#94a3b8";
  }

  // O(1) lookup maps
  const shiftsByEmpDay = useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of shifts ?? []) {
      const key = `${s.employeeId}:${toLocalDateStr(new Date(s.startTime))}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    return m;
  }, [shifts]);

  const timeOffByEmpDay = useMemo(() => {
    const m = new Map<string, TimeOffRequest[]>();
    for (const tor of timeOffRequests ?? []) {
      const start = parseDateStr(tor.startDate);
      const end   = parseDateStr(tor.endDate);
      let cur = new Date(start);
      while (cur <= end) {
        const key = `${tor.employeeId}:${toLocalDateStr(cur)}`;
        if (!m.has(key)) m.set(key, []);
        m.get(key)!.push(tor);
        cur = new Date(cur.getTime() + 86_400_000);
      }
    }
    return m;
  }, [timeOffRequests]);

  const empById = useMemo(() => new Map(activeEmployees.map((e) => [e.id, e])), [activeEmployees]);

  // ── Mutations ───────────────────────────────────────────────────────────────

  const createShift = useMutation({
    mutationFn: () => api.post("/shifts", {
      ...shiftForm,
      startTime: toISOLocal(shiftForm.startTime),
      endTime:   toISOLocal(shiftForm.endTime),
      notes: shiftForm.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setCreateOpen(false);
      setShiftForm(EMPTY_SHIFT_FORM);
      toast({ title: t("scheduling.toast.scheduled"), variant: "success" });
    },
    onError: (e: any) => toast({ title: t("scheduling.toast.couldntSchedule"), description: e?.response?.data?.error ?? t("common.error"), variant: "destructive" }),
  });

  const updateShift = useMutation({
    mutationFn: () => api.patch(`/shifts/${editingShift!.id}`, {
      startTime: toISOLocal(editShiftForm.startTime),
      endTime:   toISOLocal(editShiftForm.endTime),
      notes: editShiftForm.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setEditingShift(null);
      toast({ title: t("scheduling.editShift.toast.saved"), variant: "success" });
    },
    onError: (e: any) => toast({ title: t("scheduling.editShift.toast.couldntSave"), description: e?.response?.data?.error, variant: "destructive" }),
  });

  const deleteShift = useMutation({
    mutationFn: () => api.delete(`/shifts/${editingShift!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setConfirmDeleteShift(false);
      setEditingShift(null);
      toast({ title: t("scheduling.toast.removed"), variant: "success" });
    },
    onError: () => { setConfirmDeleteShift(false); toast({ title: t("scheduling.toast.couldntRemove"), variant: "destructive" }); },
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
          : t("scheduling.toast.generated", { count: String(created) }),
        variant: created === 0 ? "default" : "success",
      });
    },
    onError: (e: any) => toast({ title: t("scheduling.toast.couldntGenerate"), description: e?.response?.data?.error, variant: "destructive" }),
  });

  const createTimeOff = useMutation({
    mutationFn: () => api.post("/time-off-requests", {
      ...timeOffForm,
      notes: timeOffForm.notes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-off"] });
      setTimeOffOpen(false);
      setTimeOffForm(EMPTY_TIME_OFF_FORM);
      toast({ title: t("scheduling.timeOff.toast.added"), variant: "success" });
    },
    onError: (e: any) => toast({ title: t("scheduling.timeOff.toast.couldntAdd"), description: e?.response?.data?.error, variant: "destructive" }),
  });

  const removeTimeOff = useMutation({
    mutationFn: (id: string) => api.delete(`/time-off-requests/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["time-off"] });
      setDeleteTimeOff(null);
      toast({ title: t("scheduling.timeOff.toast.removed"), variant: "success" });
    },
    onError: () => { setDeleteTimeOff(null); toast({ title: t("scheduling.timeOff.toast.couldntRemove"), variant: "destructive" }); },
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function openCreateForCell(emp: Employee, date: Date) {
    const dateStr = toLocalDateStr(date);
    setShiftForm({
      employeeId: emp.id,
      locationId: emp.primaryLocationId ?? (activeLocations[0]?.id ?? ""),
      startTime: `${dateStr}T09:00`,
      endTime:   `${dateStr}T17:00`,
      notes: "",
    });
    setCreateOpen(true);
  }

  function openEditShift(s: Shift) {
    setEditingShift(s);
    setEditShiftForm({
      startTime: toDateTimeLocal(s.startTime),
      endTime:   toDateTimeLocal(s.endTime),
      notes: s.notes ?? "",
    });
    setConfirmDeleteShift(false);
  }

  function openTimeOffForEmp(empId: string, date: Date) {
    const dateStr = toLocalDateStr(date);
    setTimeOffForm({ employeeId: empId, requestType: "vacation", startDate: dateStr, endDate: dateStr, notes: "" });
    setTimeOffOpen(true);
  }

  const canSubmitShift = shiftForm.employeeId && shiftForm.locationId && shiftForm.startTime && shiftForm.endTime && !createShift.isPending;
  const canSubmitTimeOff = timeOffForm.employeeId && timeOffForm.startDate && timeOffForm.endDate && !createTimeOff.isPending;
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("scheduling.title")}</h1>
          <p className="text-sm text-slate-500">{t("scheduling.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={generateWeek.isPending} onClick={() => generateWeek.mutate()} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            {generateWeek.isPending ? t("scheduling.btn.generating") : t("scheduling.btn.generateDefaults")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setTimeOffForm(EMPTY_TIME_OFF_FORM); setTimeOffOpen(true); }} className="gap-1.5">
            <UmbrellaOff className="h-3.5 w-3.5 text-amber-500" />
            {t("scheduling.btn.markTimeOff")}
          </Button>
          <Button size="sm" onClick={() => { setShiftForm(EMPTY_SHIFT_FORM); setCreateOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> {t("scheduling.btn.scheduleShift")}
          </Button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => setWeekOffset((w) => w - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-800 min-w-[200px] text-center">{formatWeekLabel(weekDates)}</span>
        <button onClick={() => setWeekOffset((w) => w + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)} className="text-xs text-indigo-600 hover:underline ml-1">
            {t("scheduling.btn.thisWeek")}
          </button>
        )}
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="w-36 px-3 py-3 text-left border-b border-slate-200 border-r border-slate-100">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t("scheduling.calendar.team")}</span>
              </th>
              {weekDates.map((date, i) => (
                <th key={i} className={cn("px-2 py-3 text-center border-b border-slate-200 w-[calc((100%-9rem)/7)]", isToday(date) && "bg-indigo-50")}>
                  <div className={cn("text-xs font-semibold uppercase tracking-wide", isToday(date) ? "text-indigo-500" : "text-slate-400")}>{DAY_SHORT[i]}</div>
                  <div className={cn("mt-0.5 mx-auto w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold", isToday(date) ? "bg-indigo-600 text-white" : "text-slate-800")}>
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
                  <td className="px-3 py-2 border-r border-slate-100 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-slate-700 truncate" title={emp.name}>
                        {emp.name.split(" ")[0]}
                      </span>
                    </div>
                  </td>
                  {weekDates.map((date, di) => {
                    const dateStr = toLocalDateStr(date);
                    const cellShifts = shiftsByEmpDay.get(`${emp.id}:${dateStr}`) ?? [];
                    const cellTimeOff = timeOffByEmpDay.get(`${emp.id}:${dateStr}`) ?? [];
                    const hasContent = cellShifts.length > 0 || cellTimeOff.length > 0;

                    return (
                      <td
                        key={di}
                        className={cn(
                          "px-1.5 py-1.5 align-top min-h-[52px] h-14 transition-colors",
                          isToday(date) && "bg-indigo-50/40",
                          !hasContent && "group cursor-pointer hover:bg-slate-100/80",
                        )}
                        onClick={() => !hasContent && openCreateForCell(emp, date)}
                      >
                        {hasContent ? (
                          <div className="space-y-1">
                            {/* Time-off blocks */}
                            {cellTimeOff.map((tor) => {
                              const style = TIME_OFF_STYLE[tor.requestType] ?? TIME_OFF_STYLE.personal!;
                              return (
                                <div
                                  key={tor.id}
                                  className="rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity select-none"
                                  style={{ backgroundColor: `${style.color}18`, borderLeft: `3px solid ${style.color}`, color: style.color }}
                                  onClick={(e) => { e.stopPropagation(); setDeleteTimeOff(tor); }}
                                  title={tor.notes ?? tor.requestType}
                                >
                                  <div className="font-semibold leading-tight capitalize">{t(`scheduling.timeOff.type.${tor.requestType}` as any)}</div>
                                  {tor.notes && <div className="opacity-70 leading-tight truncate">{tor.notes}</div>}
                                </div>
                              );
                            })}
                            {/* Shift blocks */}
                            {cellShifts.map((s) => {
                              const c = s.roleColor ?? color;
                              return (
                                <div
                                  key={s.id}
                                  className="rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity select-none group/shift relative"
                                  style={{ backgroundColor: `${c}18`, borderLeft: `3px solid ${c}`, color: c }}
                                  onClick={(e) => { e.stopPropagation(); openEditShift(s); }}
                                  title={`${formatShiftTime(s.startTime)} – ${formatShiftTime(s.endTime)}${s.notes ? ` · ${s.notes}` : ""}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div>
                                      <div className="font-semibold leading-tight">{formatShiftTime(s.startTime)}</div>
                                      <div className="opacity-70 leading-tight">{formatShiftTime(s.endTime)}</div>
                                    </div>
                                    <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/shift:opacity-60 flex-shrink-0" />
                                  </div>
                                  {s.notes && <div className="opacity-60 leading-tight truncate text-[10px] mt-0.5">{s.notes}</div>}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1">
        {(roles ?? []).filter(r => r.color).map((r) => (
          <span key={r.id} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: r.color ?? "#6366f1" }} />
            {r.name}
          </span>
        ))}
        {(roles ?? []).length > 0 && <span className="text-slate-200">|</span>}
        {Object.entries(TIME_OFF_STYLE).map(([type, s]) => (
          <span key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
            {t(`scheduling.timeOff.type.${type}` as any)}
          </span>
        ))}
      </div>

      {/* ── Create shift dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("scheduling.createDialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("scheduling.createDialog.label.employee")}</Label>
              <Select value={shiftForm.employeeId || "none"} onValueChange={(v) => setShiftForm({ ...shiftForm, employeeId: v === "none" ? "" : v })}>
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
              <Select value={shiftForm.locationId || "none"} onValueChange={(v) => setShiftForm({ ...shiftForm, locationId: v === "none" ? "" : v })}>
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
                <input type="datetime-local" value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("scheduling.createDialog.label.end")}</Label>
                <input type="datetime-local" value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("scheduling.createDialog.label.notes")}</Label>
              <Input value={shiftForm.notes} onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })} placeholder={t("scheduling.createDialog.placeholder.notes")} />
              <Hint>{t("scheduling.createDialog.hint.notes")}</Hint>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("scheduling.createDialog.btn.cancel")}</Button>
            <Button disabled={!canSubmitShift} onClick={() => createShift.mutate()}>
              {createShift.isPending ? t("scheduling.createDialog.btn.scheduling") : t("scheduling.createDialog.btn.schedule")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit shift dialog ── */}
      <Dialog open={!!editingShift} onOpenChange={(o) => { if (!o) setEditingShift(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("scheduling.editShift.title")}</DialogTitle>
          </DialogHeader>
          {editingShift && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-500">
                {empById.get(editingShift.employeeId)?.name ?? "—"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("scheduling.editShift.label.start")}</Label>
                  <input type="datetime-local" value={editShiftForm.startTime} onChange={(e) => setEditShiftForm({ ...editShiftForm, startTime: e.target.value })} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("scheduling.editShift.label.end")}</Label>
                  <input type="datetime-local" value={editShiftForm.endTime} onChange={(e) => setEditShiftForm({ ...editShiftForm, endTime: e.target.value })} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("scheduling.editShift.label.notes")}</Label>
                <Input value={editShiftForm.notes} onChange={(e) => setEditShiftForm({ ...editShiftForm, notes: e.target.value })} placeholder={t("scheduling.editShift.placeholder.notes")} />
              </div>
              {/* Quick-fill note chips */}
              <div className="flex flex-wrap gap-2">
                {["scheduling.editShift.chip.earlyLeave", "scheduling.editShift.chip.lateStart", "scheduling.editShift.chip.halfDay"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditShiftForm({ ...editShiftForm, notes: t(key as any) })}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs border transition-colors",
                      editShiftForm.notes === t(key as any)
                        ? "bg-slate-800 text-white border-slate-800"
                        : "border-slate-200 text-slate-500 hover:border-slate-400",
                    )}
                  >
                    {t(key as any)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => setConfirmDeleteShift(true)} className="text-sm text-red-500 hover:text-red-700 hover:underline">
              {t("scheduling.editShift.btn.delete")}
            </button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingShift(null)}>{t("common.cancel")}</Button>
              <Button disabled={!editShiftForm.startTime || !editShiftForm.endTime || updateShift.isPending} onClick={() => updateShift.mutate()}>
                {updateShift.isPending ? t("common.saving") : t("scheduling.editShift.btn.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Mark time off dialog ── */}
      <Dialog open={timeOffOpen} onOpenChange={(o) => { if (!o) setTimeOffOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("scheduling.timeOff.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("scheduling.timeOff.label.employee")}</Label>
              <Select value={timeOffForm.employeeId || "none"} onValueChange={(v) => setTimeOffForm({ ...timeOffForm, employeeId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("scheduling.timeOff.placeholder.employee")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("scheduling.timeOff.placeholder.employee")}</SelectItem>
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
              <Label>{t("scheduling.timeOff.label.type")}</Label>
              <Select value={timeOffForm.requestType} onValueChange={(v) => setTimeOffForm({ ...timeOffForm, requestType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["vacation", "sick", "personal", "unpaid"] as const).map((type) => {
                    const s = TIME_OFF_STYLE[type]!;
                    return (
                      <SelectItem key={type} value={type}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                          {t(`scheduling.timeOff.type.${type}` as any)}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("scheduling.timeOff.label.startDate")}</Label>
                <input type="date" value={timeOffForm.startDate} onChange={(e) => setTimeOffForm({ ...timeOffForm, startDate: e.target.value, endDate: e.target.value })} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("scheduling.timeOff.label.endDate")}</Label>
                <input type="date" value={timeOffForm.endDate} min={timeOffForm.startDate} onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })} className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("scheduling.timeOff.label.notes")}</Label>
              <Input value={timeOffForm.notes} onChange={(e) => setTimeOffForm({ ...timeOffForm, notes: e.target.value })} placeholder={t("scheduling.timeOff.placeholder.notes")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setTimeOffOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={!canSubmitTimeOff} onClick={() => createTimeOff.mutate()}>
              {createTimeOff.isPending ? t("common.saving") : t("scheduling.timeOff.btn.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm delete shift (from edit dialog) */}
      <ConfirmDialog
        open={confirmDeleteShift}
        onOpenChange={(o) => { if (!o) setConfirmDeleteShift(false); }}
        title={t("scheduling.deleteDialog.title")}
        description={editingShift ? `${empById.get(editingShift.employeeId)?.name ?? "—"} · ${formatShiftTime(editingShift.startTime)} – ${formatShiftTime(editingShift.endTime)}` : ""}
        confirmLabel={t("scheduling.deleteDialog.confirmLabel")}
        destructive
        loading={deleteShift.isPending}
        onConfirm={() => deleteShift.mutate()}
      />

      {/* Confirm remove time off */}
      <ConfirmDialog
        open={!!deleteTimeOff}
        onOpenChange={(o) => { if (!o) setDeleteTimeOff(null); }}
        title={t("scheduling.timeOff.deleteDialog.title")}
        description={deleteTimeOff
          ? `${empById.get(deleteTimeOff.employeeId)?.name ?? "—"} · ${t(`scheduling.timeOff.type.${deleteTimeOff.requestType}` as any)} · ${deleteTimeOff.startDate}${deleteTimeOff.endDate !== deleteTimeOff.startDate ? ` → ${deleteTimeOff.endDate}` : ""}`
          : ""}
        confirmLabel={t("scheduling.timeOff.deleteDialog.confirmLabel")}
        destructive
        loading={removeTimeOff.isPending}
        onConfirm={() => deleteTimeOff && removeTimeOff.mutate(deleteTimeOff.id)}
      />
    </div>
  );
}
