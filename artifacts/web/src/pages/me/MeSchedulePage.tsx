import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { Calendar } from "lucide-react";

export function MeSchedulePage() {
  const { data: shifts } = useQuery({
    queryKey: ["me-shifts"],
    queryFn: () => api.get("/me/shifts").then((r) => r.data as any[]),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Schedule</h1>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Upcoming Shifts</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!(shifts ?? []).length && <p className="text-sm text-slate-400">No upcoming shifts scheduled.</p>}
          {(shifts ?? []).map((shift: any) => {
            const start = new Date(shift.startTime);
            const end = new Date(shift.endTime);
            const durationHrs = ((end.getTime() - start.getTime()) / 3600000).toFixed(1);
            return (
              <div key={shift.id} className="rounded-lg border border-slate-100 p-3 space-y-1">
                <p className="font-semibold text-sm">
                  {start.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </p>
                <p className="text-sm text-slate-600">
                  {formatDateTime(shift.startTime)} – {new Date(shift.endTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-xs text-slate-400">{durationHrs} hours{shift.notes ? ` · ${shift.notes}` : ""}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
