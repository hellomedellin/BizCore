import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { Download, CheckCircle, XCircle } from "lucide-react";

const STATUS_COLORS: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
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

  const { data: entries } = useQuery({
    queryKey: ["time-entries", from, to],
    queryFn: () => api.get(`/time-entries?from=${from}T00:00:00Z&to=${to}T23:59:59Z`).then((r) => r.data),
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      api.post(`/time-entries/${id}/review`, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time-entries"] }),
  });

  const exportCsv = async () => {
    const res = await api.get(`/time-entries/export?from=${from}T00:00:00Z&to=${to}T23:59:59Z`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a"); a.href = url; a.download = "time-export.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Time Tracking</h1>
        <Button variant="outline" onClick={exportCsv}><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Clock In</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Clock Out</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Total (min)</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {!(entries ?? []).length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No time entries in this range.</td></tr>
              )}
              {(entries ?? []).map((e: any) => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{e.employeeId.slice(0, 8)}</td>
                  <td className="px-4 py-3 capitalize">{e.entryType.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-xs">{formatDateTime(e.clockIn)}</td>
                  <td className="px-4 py-3 text-xs">{e.clockOut ? formatDateTime(e.clockOut) : <span className="text-green-600 font-semibold">Active</span>}</td>
                  <td className="px-4 py-3 text-right">{e.totalMinutes ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={STATUS_COLORS[e.status] ?? "secondary"}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {e.status === "pending" && (
                      <div className="flex gap-1">
                        <button onClick={() => review.mutate({ id: e.id, action: "approve" })} className="text-green-600 hover:text-green-800">
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button onClick={() => review.mutate({ id: e.id, action: "reject" })} className="text-red-500 hover:text-red-700">
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
    </div>
  );
}
