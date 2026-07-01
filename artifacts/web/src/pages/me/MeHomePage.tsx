import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PurchaseCapture } from "@/components/PurchaseCapture";
import { formatDateTime } from "@/lib/utils";
import { Clock, LogIn, LogOut, Camera } from "lucide-react";

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700",
  admin: "bg-violet-100 text-violet-700",
  manager: "bg-blue-100 text-blue-700",
  accountant: "bg-emerald-100 text-emerald-700",
  staff: "bg-slate-100 text-slate-500",
};

export function MeHomePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [breakMinutes, setBreakMinutes] = useState(0);

  const canCapture = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data as Array<{ id: string; active?: boolean }>),
    enabled: canCapture,
  });
  const captureLocationId = (locations ?? []).find((l) => l.active !== false)?.id ?? null;

  const { data: profile } = useQuery({
    queryKey: ["me-profile"],
    queryFn: () => api.get("/me/").then((r) => r.data),
  });

  const { data: recent } = useQuery({
    queryKey: ["me-time-entries"],
    queryFn: () => api.get("/me/time-entries").then((r) => r.data as any[]),
    refetchInterval: 30_000,
  });

  const clockIn = useMutation({
    mutationFn: () => api.post("/me/clock-in", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-time-entries"] }),
  });

  const clockOut = useMutation({
    mutationFn: () => api.post("/me/clock-out", { breakMinutes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-time-entries"] }),
  });

  const openEntry = (recent ?? []).find((e: any) => !e.clockOut);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hello, {profile?.name?.split(" ")[0] ?? "there"} 👋</h1>
        <div className="mt-1 flex items-center gap-2">
          {profile?.role && <span className="text-sm text-slate-500">{profile.role.name}</span>}
          {user?.role && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_BADGE[user.role] ?? "bg-slate-100 text-slate-500"}`}>
              {user.role}
            </span>
          )}
        </div>
      </div>

      {/* Clock in / out */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Time Clock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {openEntry ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="font-semibold text-green-800">Currently clocked in</p>
                <p className="text-sm text-green-600">Since {formatDateTime(openEntry.clockIn)}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm">Break minutes:</label>
                <input type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(parseInt(e.target.value) || 0)}
                  className="h-9 w-20 rounded-md border border-slate-300 px-3 text-sm" />
              </div>
              <Button className="w-full" variant="destructive" onClick={() => clockOut.mutate()} disabled={clockOut.isPending}>
                <LogOut className="mr-2 h-4 w-4" /> Clock Out
              </Button>
            </div>
          ) : (
            <Button className="w-full" onClick={() => clockIn.mutate()} disabled={clockIn.isPending}>
              <LogIn className="mr-2 h-4 w-4" /> Clock In
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Scan receipt — managers only */}
      {canCapture && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Purchases</CardTitle></CardHeader>
          <CardContent>
            <PurchaseCapture locationId={captureLocationId} />
          </CardContent>
        </Card>
      )}

      {/* Recent time entries */}
      <Card>
        <CardHeader><CardTitle>Recent Entries</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!(recent ?? []).slice(0, 7).length && <p className="text-sm text-slate-400">No time entries yet.</p>}
          {(recent ?? []).slice(0, 7).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border border-slate-100 p-2">
              <div>
                <p className="text-sm font-medium">{formatDateTime(e.clockIn)}</p>
                <p className="text-xs text-slate-400">{e.totalMinutes != null ? `${e.totalMinutes} min` : "In progress"}</p>
              </div>
              <Badge variant={e.status === "approved" ? "success" : e.status === "rejected" ? "destructive" : "warning"}>
                {e.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
