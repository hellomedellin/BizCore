import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTimeEntries,
  useGetEmployees,
  useGetLocations,
  useClockIn,
  useClockOut,
  useApproveTimeEntry,
  useRejectTimeEntry,
  getGetTimeEntriesQueryKey,
} from "@workspace/api-client-react";
import type { TimeEntry } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Clock,
  ClockArrowDown,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  Users,
  MapPin,
  AlertCircle,
} from "lucide-react";

function formatDateTime(dt: string | Date | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-300">Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-300">Rejected</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

function ClockInDialog({
  open,
  onOpenChange,
  employees,
  locations,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: { id: number; name: string }[];
  locations: { id: number; name: string }[];
  onSuccess: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [locationId, setLocationId] = useState("none");
  const [notes, setNotes] = useState("");
  const clockIn = useClockIn();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!employeeId) { toast({ title: "Select an employee", variant: "destructive" }); return; }
    try {
      await clockIn.mutateAsync({
        data: {
          employeeId: parseInt(employeeId),
          locationId: locationId !== "none" ? parseInt(locationId) : null,
          notes: notes || null,
        },
      });
      toast({ title: "Clocked in" });
      onSuccess();
      onOpenChange(false);
      setEmployeeId(""); setLocationId("none"); setNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("409") || msg.includes("already")) {
        toast({ title: "Employee is already clocked in", variant: "destructive" });
      } else {
        toast({ title: "Error clocking in", variant: "destructive" });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-4 w-4" /> Clock In
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Employee *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="No location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={clockIn.isPending}>
            Clock In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry?: TimeEntry;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const rejectEntry = useRejectTimeEntry();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason.trim() || !entry) { toast({ title: "Reason is required", variant: "destructive" }); return; }
    try {
      await rejectEntry.mutateAsync({ id: entry.id, data: { reason: reason.trim() } });
      toast({ title: "Time entry rejected" });
      onSuccess();
      onOpenChange(false);
      setReason("");
    } catch {
      toast({ title: "Error rejecting entry", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reject Time Entry</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            Rejecting entry for <strong>{entry?.employeeName}</strong>. The employee can update and resubmit.
          </p>
          <div className="grid gap-1.5">
            <Label>Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this entry is being rejected..."
              rows={3}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={rejectEntry.isPending}>
            Reject Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TimeEntryRow({
  entry,
  onClockOut,
  onApprove,
  onReject,
}: {
  entry: TimeEntry;
  onClockOut: (entry: TimeEntry) => void;
  onApprove: (entry: TimeEntry) => void;
  onReject: (entry: TimeEntry) => void;
}) {
  const isOpen = !entry.clockOut;
  const isPending = entry.status === "pending" && !!entry.clockOut;

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium text-sm">{entry.employeeName}</p>
          {entry.locationName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {entry.locationName}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">{formatDateTime(entry.clockIn)}</TableCell>
      <TableCell className="text-sm">
        {isOpen ? (
          <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300">
            <Clock className="h-3 w-3" /> Open
          </Badge>
        ) : (
          formatDateTime(entry.clockOut)
        )}
      </TableCell>
      <TableCell className="text-sm font-mono">
        {isOpen ? "—" : formatDuration(entry.durationMinutes)}
      </TableCell>
      <TableCell>{statusBadge(entry.status)}</TableCell>
      <TableCell>
        {entry.rejectionReason && (
          <p className="text-xs text-muted-foreground max-w-[200px] truncate" title={entry.rejectionReason}>
            {entry.rejectionReason}
          </p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 justify-end">
          {isOpen && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onClockOut(entry)}>
              <LogOut className="h-3 w-3" /> Clock Out
            </Button>
          )}
          {isPending && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50" onClick={() => onApprove(entry)}>
                <CheckCircle className="h-3 w-3" /> Approve
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => onReject(entry)}>
                <XCircle className="h-3 w-3" /> Reject
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function EntriesTable({
  entries,
  isLoading,
  onClockOut,
  onApprove,
  onReject,
  emptyMessage,
}: {
  entries: TimeEntry[] | undefined;
  isLoading: boolean;
  onClockOut: (e: TimeEntry) => void;
  onApprove: (e: TimeEntry) => void;
  onReject: (e: TimeEntry) => void;
  emptyMessage: string;
}) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <Clock className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Clock In</TableHead>
          <TableHead>Clock Out</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Notes / Reason</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TimeEntryRow
            key={entry.id}
            entry={entry}
            onClockOut={onClockOut}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export default function TimeTrackingPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");

  const [clockInDialog, setClockInDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; entry?: TimeEntry }>({ open: false });

  const { data: employees } = useGetEmployees({ active: true });
  const { data: locations } = useGetLocations();

  const baseParams = {
    ...(employeeFilter !== "all" ? { employeeId: parseInt(employeeFilter) } : {}),
    ...(locationFilter !== "all" ? { locationId: parseInt(locationFilter) } : {}),
  };

  const allParams = { ...baseParams };
  const pendingParams = { ...baseParams, status: "pending" as const };

  const { data: allEntries, isLoading: allLoading } = useGetTimeEntries(allParams, {
    query: { queryKey: getGetTimeEntriesQueryKey(allParams) },
  });
  const { data: pendingEntries, isLoading: pendingLoading } = useGetTimeEntries(pendingParams, {
    query: { queryKey: getGetTimeEntriesQueryKey(pendingParams) },
  });

  const clockOut = useClockOut();
  const approveEntry = useApproveTimeEntry();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetTimeEntriesQueryKey() });

  const handleClockOut = async (entry: TimeEntry) => {
    try {
      await clockOut.mutateAsync({ id: entry.id, data: {} });
      invalidate();
      toast({ title: `${entry.employeeName} clocked out` });
    } catch {
      toast({ title: "Error clocking out", variant: "destructive" });
    }
  };

  const handleApprove = async (entry: TimeEntry) => {
    try {
      await approveEntry.mutateAsync({ id: entry.id, data: {} });
      invalidate();
      toast({ title: `Entry approved` });
    } catch {
      toast({ title: "Error approving entry", variant: "destructive" });
    }
  };

  const openCount = allEntries?.filter((e) => !e.clockOut).length ?? 0;
  const pendingCount = pendingEntries?.filter((e) => !!e.clockOut).length ?? 0;

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time Tracking</h1>
          <p className="text-muted-foreground">Clock in/out and approve time entries.</p>
        </div>
        <Button onClick={() => setClockInDialog(true)}>
          <LogIn className="mr-2 h-4 w-4" /> Clock In
        </Button>
      </div>

      {!allLoading && allEntries && allEntries.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          <div className="rounded-lg border bg-card px-4 py-3 min-w-[120px]">
            <p className="text-xs text-muted-foreground">Currently Clocked In</p>
            <p className="text-2xl font-bold text-orange-600">{openCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3 min-w-[120px]">
            <p className="text-xs text-muted-foreground">Pending Approval</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3 min-w-[120px]">
            <p className="text-xs text-muted-foreground">Total Entries</p>
            <p className="text-2xl font-bold">{allEntries.length}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees?.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations?.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="px-6 border-b">
              <TabsList className="h-9 rounded-none bg-transparent p-0 gap-4">
                <TabsTrigger
                  value="all"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 text-sm"
                >
                  All Entries
                </TabsTrigger>
                <TabsTrigger
                  value="pending"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 text-sm"
                >
                  Pending Approval
                  {pendingCount > 0 && (
                    <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-amber-500 text-white hover:bg-amber-500">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="open"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 pb-2 text-sm"
                >
                  Currently Open
                  {openCount > 0 && (
                    <Badge className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-orange-500 text-white hover:bg-orange-500">
                      {openCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="m-0">
              <EntriesTable
                entries={allEntries}
                isLoading={allLoading}
                onClockOut={handleClockOut}
                onApprove={handleApprove}
                onReject={(e) => setRejectDialog({ open: true, entry: e })}
                emptyMessage="No time entries yet"
              />
            </TabsContent>
            <TabsContent value="pending" className="m-0">
              <EntriesTable
                entries={pendingEntries?.filter((e) => !!e.clockOut)}
                isLoading={pendingLoading}
                onClockOut={handleClockOut}
                onApprove={handleApprove}
                onReject={(e) => setRejectDialog({ open: true, entry: e })}
                emptyMessage="No entries pending approval"
              />
            </TabsContent>
            <TabsContent value="open" className="m-0">
              <EntriesTable
                entries={allEntries?.filter((e) => !e.clockOut)}
                isLoading={allLoading}
                onClockOut={handleClockOut}
                onApprove={handleApprove}
                onReject={(e) => setRejectDialog({ open: true, entry: e })}
                emptyMessage="No employees currently clocked in"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ClockInDialog
        open={clockInDialog}
        onOpenChange={setClockInDialog}
        employees={employees ?? []}
        locations={locations ?? []}
        onSuccess={invalidate}
      />

      <RejectDialog
        open={rejectDialog.open}
        onOpenChange={(v) => setRejectDialog((d) => ({ ...d, open: v }))}
        entry={rejectDialog.entry}
        onSuccess={invalidate}
      />
    </div>
  );
}
