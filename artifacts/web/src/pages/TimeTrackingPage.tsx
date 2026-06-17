import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { Download, CheckCircle, XCircle, Clock } from "lucide-react";

interface TimeEntry {
  id: string;
  employeeId: string;
  entryType: string;
  clockIn: string;
  clockOut: string | null;
  totalMinutes: number | null;
  status: "pending" | "approved" | "rejected";
}
interface Employee { id: string; name: string }

const STATUS_BADGE: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export function TimeTrackingPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: entries, isLoading } = useQuery({
    queryKey: ["time-entries", from, to],
    queryFn: () => api.get(`/time-entries?from=${from}T00:00:00Z&to=${to}T23:59:59Z`).then((r) => r.data as TimeEntry[]),
  });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/employees").then((r) => r.data as Employee[]),
  });

  const empName = (id: string) => employees?.find((e) => e.id === id)?.name ?? "—";

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api.post(`/time-entries/${id}/review`, { action }),
    onSuccess: (_d, { action }) => {
      qc.invalidateQueries({ queryKey: ["time-entries"] });
      toast({ title: action === "approve" ? "Entry approved" : "Entry rejected", variant: "success" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const exportCsv = async () => {
    try {
      const res = await api.get(`/time-entries/export?from=${from}T00:00:00Z&to=${to}T23:59:59Z`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = "time-export.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Time Tracking</h1>
          <p className="text-sm text-slate-500">Clock-in / clock-out records. Approve or reject entries.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-1 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {isLoading ? null : !(entries ?? []).length ? (
        <GuidedEmptyState
          icon={Clock}
          title="No time entries in this range"
          description="Employees clock in and out from their staff portal. Once they do, their entries appear here for you to review."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Employee</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Clock In</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Clock Out</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Minutes</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {(entries ?? []).map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{empName(e.employeeId)}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">{e.entryType.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatDateTime(e.clockIn)}</td>
                    <td className="px-4 py-3 text-xs">
                      {e.clockOut ? formatDateTime(e.clockOut) : <span className="font-semibold text-green-600">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{e.totalMinutes ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={STATUS_BADGE[e.status] ?? "secondary"}>{e.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {e.status === "pending" && (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => review.mutate({ id: e.id, action: "approve" })}
                            className="text-green-500 hover:text-green-700 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => review.mutate({ id: e.id, action: "reject" })}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
