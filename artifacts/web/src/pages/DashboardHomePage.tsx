import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, orderTone } from "@/components/ui/status-badge";
import { useCurrency } from "@/hooks/useCurrency";
import { useLocationContext } from "@/hooks/useLocation";
import { useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/utils";
import { ShoppingCart, TrendingUp, TrendingDown, AlertTriangle, Users, ClipboardCheck, ArrowRight } from "lucide-react";

interface Briefing {
  revenueToday: string;
  revenuePrevWeek: string;
  ordersToday: number;
  activeOrders: number;
  lowStock: { name: string; quantity: string; threshold: string | null }[];
  staffToday: { employeeName: string; roleName: string | null; roleColor: string | null; startTime: string; endTime: string }[];
  pendingTimeEntries: number;
  pendingTimeOff: number;
}

// Today's local-day window [start, start-of-tomorrow). The server derives the
// prior-week window by subtracting 7 days.
function dayWindow() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

const shiftTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function DashboardHomePage() {
  const t = useT();
  const { fmt } = useCurrency();
  const { activeLocationId } = useLocationContext();

  const { data: business } = useQuery({
    queryKey: ["businesses", "me"],
    queryFn: () => api.get("/businesses/me").then((r) => r.data),
  });

  const { from, to } = dayWindow();
  const { data: b } = useQuery({
    queryKey: ["dashboard-briefing", activeLocationId, from],
    queryFn: () =>
      api
        .get(`/dashboard/briefing?from=${from}&to=${to}${activeLocationId ? `&locationId=${activeLocationId}` : ""}`)
        .then((r) => r.data as Briefing),
  });

  const { data: recent } = useQuery({
    queryKey: ["orders-recent", activeLocationId],
    queryFn: () =>
      api.get(`/orders?limit=6${activeLocationId ? `&locationId=${activeLocationId}` : ""}`).then((r) => r.data as any[]),
  });

  const today = parseFloat(b?.revenueToday ?? "0");
  const prev = parseFloat(b?.revenuePrevWeek ?? "0");
  const deltaPct = prev > 0 ? Math.round(((today - prev) / prev) * 100) : null;
  const up = deltaPct != null && deltaPct >= 0;
  const pendingTotal = (b?.pendingTimeEntries ?? 0) + (b?.pendingTimeOff ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{business?.name ?? t("dashboard.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("dashboard.subtitle")}</p>
      </div>

      {/* Hero: revenue today + comparison, active orders, orders today */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("dashboard.briefing.revenueToday")}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{fmt(today)}</p>
            {deltaPct != null ? (
              <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600" : "text-red-600"}`}>
                {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(deltaPct)}% {t("dashboard.briefing.vsLastWeek")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">{t("dashboard.briefing.lastWeek")}: {fmt(prev)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" /> {t("dashboard.briefing.activeOrders")}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{b?.activeOrders ?? 0}</p>
            <Link href="/dashboard/sales" className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
              {t("dashboard.briefing.goToSales")} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t("dashboard.briefing.ordersToday")}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{b?.ordersToday ?? 0}</p>
            <p className="mt-1 text-xs text-slate-400">{t("dashboard.briefing.completedToday")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Attention row: low stock + pending approvals */}
      {((b?.lowStock.length ?? 0) > 0 || pendingTotal > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(b?.lowStock.length ?? 0) > 0 && (
            <Card className="border-red-100">
              <CardContent className="p-5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                  <AlertTriangle className="h-4 w-4" /> {t("dashboard.briefing.runningLow")}
                </p>
                <ul className="mt-2 space-y-1">
                  {b!.lowStock.slice(0, 6).map((l, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-slate-700">{l.name}</span>
                      <span className="tabular-nums text-red-600">{parseFloat(l.quantity)} {t("dashboard.briefing.left")}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard/ingredients" className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
                  {t("dashboard.briefing.goToIngredients")} <ArrowRight className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>
          )}

          {pendingTotal > 0 && (
            <Card className="border-amber-100">
              <CardContent className="p-5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                  <ClipboardCheck className="h-4 w-4" /> {t("dashboard.briefing.needsApproval")}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {(b?.pendingTimeEntries ?? 0) > 0 && (
                    <li><Link href="/dashboard/time-tracking" className="hover:underline">{t("dashboard.briefing.pendingTimeEntries", { count: String(b!.pendingTimeEntries) })}</Link></li>
                  )}
                  {(b?.pendingTimeOff ?? 0) > 0 && (
                    <li><Link href="/dashboard/scheduling" className="hover:underline">{t("dashboard.briefing.pendingTimeOff", { count: String(b!.pendingTimeOff) })}</Link></li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* On today */}
      <Card>
        <CardContent className="p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4 text-slate-400" /> {t("dashboard.briefing.onToday")}
          </p>
          {(b?.staffToday.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-slate-400">{t("dashboard.briefing.noStaff")}</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {b!.staffToday.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1.5 pr-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.roleColor ?? "#94a3b8" }} />
                  <span className="text-sm font-medium text-slate-700">{s.employeeName}</span>
                  <span className="text-xs text-slate-400">{shiftTime(s.startTime)}–{shiftTime(s.endTime)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent orders */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">{t("dashboard.recentOrders.title")}</p>
            <Link href="/dashboard/sales" className="text-xs text-slate-500 hover:text-slate-900">{t("dashboard.briefing.viewAll")}</Link>
          </div>
          {!(recent ?? []).length ? (
            <p className="mt-2 text-sm text-slate-400">{t("dashboard.recentOrders.empty")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {(recent ?? []).map((o) => (
                <div key={o.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium">{(o.orderType as string).replace("_", " ")} — #{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(o.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">{fmt(o.total)}</span>
                    <StatusBadge tone={orderTone(o.status)}>{o.status}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
