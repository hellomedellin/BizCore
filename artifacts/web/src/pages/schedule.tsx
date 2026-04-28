import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetShifts,
  useGetEmployees,
  useGetLocations,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  getGetShiftsQueryKey,
} from "@workspace/api-client-react";
import type { Shift, CreateShiftBody, UpdateShiftBody } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type ShiftFormData = {
  employeeId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  notes: string;
};

const EMPTY_FORM: ShiftFormData = {
  employeeId: "",
  locationId: "",
  startTime: "",
  endTime: "",
  notes: "",
};

function ShiftDialog({
  open,
  onOpenChange,
  shift,
  employees,
  locations,
  prefillDay,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shift?: Shift;
  employees: { id: number; name: string }[];
  locations: { id: number; name: string }[];
  prefillDay?: Date;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const isEditing = !!shift;

  const defaultStart = prefillDay
    ? formatDateTimeLocal(new Date(prefillDay.getFullYear(), prefillDay.getMonth(), prefillDay.getDate(), 9, 0))
    : "";
  const defaultEnd = prefillDay
    ? formatDateTimeLocal(new Date(prefillDay.getFullYear(), prefillDay.getMonth(), prefillDay.getDate(), 17, 0))
    : "";

  const [form, setForm] = useState<ShiftFormData>(
    shift
      ? {
          employeeId: String(shift.employeeId),
          locationId: String(shift.locationId),
          startTime: formatDateTimeLocal(new Date(shift.startTime)),
          endTime: formatDateTimeLocal(new Date(shift.endTime)),
          notes: shift.notes ?? "",
        }
      : { ...EMPTY_FORM, startTime: defaultStart, endTime: defaultEnd }
  );

  const set = (key: keyof ShiftFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.employeeId || !form.locationId || !form.startTime || !form.endTime) {
      toast({ title: "All fields except notes are required", variant: "destructive" });
      return;
    }
    if (new Date(form.startTime) >= new Date(form.endTime)) {
      toast({ title: "Start time must be before end time", variant: "destructive" });
      return;
    }
    try {
      if (isEditing) {
        await updateShift.mutateAsync({
          id: shift!.id,
          data: {
            employeeId: parseInt(form.employeeId),
            locationId: parseInt(form.locationId),
            startTime: new Date(form.startTime).toISOString(),
            endTime: new Date(form.endTime).toISOString(),
            notes: form.notes || null,
          } as UpdateShiftBody,
        });
        toast({ title: "Shift updated" });
      } else {
        await createShift.mutateAsync({
          data: {
            employeeId: parseInt(form.employeeId),
            locationId: parseInt(form.locationId),
            startTime: new Date(form.startTime).toISOString(),
            endTime: new Date(form.endTime).toISOString(),
            notes: form.notes || null,
          } as CreateShiftBody,
        });
        toast({ title: "Shift created" });
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Error saving shift", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Shift" : "Add Shift"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Employee *</Label>
            <Select value={form.employeeId} onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Location *</Label>
            <Select value={form.locationId} onValueChange={(v) => setForm((f) => ({ ...f, locationId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start *</Label>
              <input
                type="datetime-local"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.startTime}
                onChange={set("startTime")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>End *</Label>
              <input
                type="datetime-local"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.endTime}
                onChange={set("endTime")}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={set("notes")}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createShift.isPending || updateShift.isPending}>
            {isEditing ? "Save Changes" : "Create Shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EMPLOYEE_COLORS = [
  "bg-blue-100 border-blue-300 text-blue-900",
  "bg-green-100 border-green-300 text-green-900",
  "bg-purple-100 border-purple-300 text-purple-900",
  "bg-orange-100 border-orange-300 text-orange-900",
  "bg-pink-100 border-pink-300 text-pink-900",
  "bg-teal-100 border-teal-300 text-teal-900",
  "bg-yellow-100 border-yellow-300 text-yellow-900",
  "bg-red-100 border-red-300 text-red-900",
];

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [locationFilter, setLocationFilter] = useState("all");
  const [shiftDialog, setShiftDialog] = useState<{ open: boolean; shift?: Shift; prefillDay?: Date }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; shift?: Shift }>({ open: false });

  const weekEnd = addDays(weekStart, 7);

  const queryParams = {
    from: weekStart.toISOString(),
    to: weekEnd.toISOString(),
    ...(locationFilter !== "all" ? { locationId: parseInt(locationFilter) } : {}),
  };

  const { data: shifts, isLoading } = useGetShifts(queryParams, {
    query: { queryKey: getGetShiftsQueryKey(queryParams) },
  });
  const { data: employees } = useGetEmployees({ active: true });
  const { data: locations } = useGetLocations();
  const deleteShift = useDeleteShift();

  const employeeColorMap = useMemo(() => {
    const map = new Map<number, string>();
    (employees ?? []).forEach((e, i) => {
      map.set(e.id, EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length]);
    });
    return map;
  }, [employees]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetShiftsQueryKey() });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    weekDays.forEach((d) => map.set(d.toDateString(), []));
    (shifts ?? []).forEach((s) => {
      const key = new Date(s.startTime).toDateString();
      if (map.has(key)) map.get(key)!.push(s);
    });
    return map;
  }, [shifts, weekDays]);

  const handleDelete = async () => {
    if (!deleteDialog.shift) return;
    try {
      await deleteShift.mutateAsync({ id: deleteDialog.shift.id });
      invalidate();
      toast({ title: "Shift deleted" });
    } catch {
      toast({ title: "Error deleting shift", variant: "destructive" });
    } finally {
      setDeleteDialog({ open: false });
    }
  };

  const today = new Date().toDateString();

  const weekLabel = `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">Manage shift assignments for your team.</p>
        </div>
        <Button onClick={() => setShiftDialog({ open: true })}>
          <Plus className="mr-2 h-4 w-4" /> Add Shift
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-md border bg-card p-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-sm font-medium" onClick={() => setWeekStart(getWeekStart(new Date()))}>
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            {weekLabel}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locations?.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {shifts && shifts.some((s) => s.hasConflict) && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Scheduling conflicts detected
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5 min-w-0">
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === today;
            const dayShifts = shiftsByDay.get(day.toDateString()) ?? [];

            return (
              <div key={i} className="flex flex-col gap-1.5 min-w-0">
                <div
                  className={`rounded-md px-2 py-1.5 text-center ${isToday ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}
                >
                  <p className="text-xs font-medium">{DAYS[i]}</p>
                  <p className={`text-sm font-bold ${isToday ? "" : "text-foreground"}`}>{day.getDate()}</p>
                </div>

                <button
                  className="flex items-center justify-center h-8 rounded border border-dashed text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full"
                  onClick={() => setShiftDialog({ open: true, prefillDay: day })}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>

                <div className="flex flex-col gap-1 min-h-[8rem]">
                  {dayShifts.map((shift) => {
                    const colorClass = employeeColorMap.get(shift.employeeId) ?? EMPLOYEE_COLORS[0];
                    return (
                      <Card
                        key={shift.id}
                        className={`border cursor-pointer hover:shadow-sm transition-shadow ${colorClass} ${shift.hasConflict ? "ring-2 ring-destructive" : ""}`}
                        onClick={() => setShiftDialog({ open: true, shift })}
                      >
                        <CardContent className="p-1.5">
                          <p className="text-xs font-semibold truncate">{shift.employeeName}</p>
                          <p className="text-xs opacity-80">
                            {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                          </p>
                          {shift.hasConflict && (
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <AlertTriangle className="h-2.5 w-2.5 text-destructive" />
                              <span className="text-[10px] text-destructive font-medium">Conflict</span>
                            </div>
                          )}
                          <div className="flex justify-end gap-0.5 mt-1">
                            <button
                              className="p-0.5 rounded hover:bg-black/10"
                              onClick={(e) => { e.stopPropagation(); setShiftDialog({ open: true, shift }); }}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                            <button
                              className="p-0.5 rounded hover:bg-black/10"
                              onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, shift }); }}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && shifts && shifts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed">
          <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No shifts this week</p>
          <p className="text-sm text-muted-foreground mt-1">Click + on any day or the Add Shift button to schedule a shift.</p>
        </div>
      )}

      <ShiftDialog
        open={shiftDialog.open}
        onOpenChange={(v) => setShiftDialog((d) => ({ ...d, open: v }))}
        shift={shiftDialog.shift}
        prefillDay={shiftDialog.prefillDay}
        employees={employees ?? []}
        locations={locations ?? []}
        onSuccess={invalidate}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={(v) => setDeleteDialog((d) => ({ ...d, open: v }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the shift for{" "}
              <strong>{deleteDialog.shift?.employeeName}</strong> on{" "}
              {deleteDialog.shift && formatDate(new Date(deleteDialog.shift.startTime))}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
