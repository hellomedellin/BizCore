import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Package, Users, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export function DashboardHomePage() {
  const t = useT();
  const { data: orders } = useQuery({
    queryKey: ["orders-recent"],
    queryFn: () => api.get("/orders?limit=5").then((r) => r.data),
  });

  const { data: business } = useQuery({
    queryKey: ["business"],
    queryFn: () => api.get("/businesses/me").then((r) => r.data),
  });

  const pendingOrders = (orders ?? []).filter((o: any) => o.status === "pending" || o.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{business?.name ?? "Dashboard"}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("dashboard.subtitle")}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> {t("dashboard.kpi.activeOrders")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Package className="h-4 w-4" /> {t("dashboard.kpi.totalOrdersToday")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(orders ?? []).length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Clock className="h-4 w-4" /> {t("dashboard.kpi.currency")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{business?.currencyCode ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Users className="h-4 w-4" /> {t("dashboard.kpi.revenueToday")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(
                (orders ?? []).reduce((sum: number, o: any) => sum + parseFloat(o.total ?? "0"), 0),
                business?.currencyCode
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recentOrders.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!(orders ?? []).length && <p className="text-sm text-slate-500">{t("dashboard.recentOrders.empty")}</p>}
          <div className="space-y-2">
            {(orders ?? []).map((order: any) => (
              <div key={order.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-sm">{order.orderType.replace("_", " ")} — #{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(order.total, order.currencyCode)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    order.status === "completed" ? "bg-green-100 text-green-700"
                    : order.status === "cancelled" ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                  }`}>{order.status}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
