import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useCurrency } from "@/hooks/useCurrency";
import { TrendingUp, ShoppingCart, Users, Printer, ChevronDown, ChevronUp } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfitLoss {
  period: { from: string; to: string };
  revenue: string; cogs: string; grossProfit: string;
  grossMarginPct: number; orderCount: number;
  avgOrderValue: number; taxCollected: number;
  revenueByDay: { date: string; revenue: number; orderCount: number }[];
  revenueByOrderType: { orderType: string; revenue: number; orderCount: number }[];
}
interface SalesSummary {
  period: { from: string; to: string };
  totalRevenue: number; totalOrders: number; avgOrderValue: number;
  topItems: { name: string; qty: number; revenue: number }[];
  byPaymentMethod: { method: string; revenue: number; tips: number; count: number }[];
  byOrderType: { orderType: string; revenue: number; orderCount: number }[];
}
interface PayrollReport {
  period: { from: string; to: string };
  employees: {
    id: string; name: string; roleName: string | null;
    regularMinutes: number; overtimeMinutes: number; totalMinutes: number;
    hourlyRate: string | null; estimatedWages: string;
    daysOff: { vacation: number; sick: number; personal: number; unpaid: number };
  }[];
  totals: { totalMinutes: number; totalEstimatedWages: string };
}

type ReportType = "profit-loss" | "sales" | "payroll";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function defaultDates() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toLocalDateStr(from), to: toLocalDateStr(now) };
}

function fmtHours(minutes: number): string {
  const h = minutes / 60;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function formatDateLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatPeriodLabel(from: string, to: string): string {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  return `${fmt(f)} – ${fmt(t)}`;
}

function orderTypeLabel(t: ReturnType<typeof useT>, type: string): string {
  const map: Record<string, string> = {
    dine_in: t("sales.orderType.dineIn"),
    pickup:  t("sales.orderType.pickup"),
    delivery: t("sales.orderType.delivery"),
    retail:  t("sales.orderType.retail"),
    service: t("sales.orderType.service"),
  };
  return map[type] ?? type;
}

function paymentMethodLabel(t: ReturnType<typeof useT>, method: string): string {
  const map: Record<string, string> = {
    cash: t("sales.paymentMethod.cash"),
    card: t("sales.paymentMethod.card"),
    transfer: t("sales.paymentMethod.transfer"),
    nequi: t("sales.paymentMethod.nequi"),
    daviplata: t("sales.paymentMethod.daviplata"),
    other: t("sales.paymentMethod.other"),
  };
  return map[method] ?? method;
}

// ── Bar chart row ─────────────────────────────────────────────────────────────

function BarRow({ label, value, total, fmt, color = "#6366f1" }: { label: string; value: number; total: number; fmt: (v: number | string) => string; color?: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-xs text-slate-600 truncate text-right">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-xs text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
      <span className="w-24 text-xs font-semibold text-slate-800 text-right tabular-nums">{fmt(value)}</span>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4", accent ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-white")}>
      <p className={cn("text-xs font-semibold uppercase tracking-wide", accent ? "text-indigo-500" : "text-slate-400")}>
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", accent ? "text-indigo-700" : "text-slate-900")}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

// ── Profit & Loss report ──────────────────────────────────────────────────────

function ProfitLossReport({ data }: { data: ProfitLoss }) {
  const t = useT();
  const { fmt } = useCurrency();
  const totalRevenue = parseFloat(data.revenue);
  const [showDailyTable, setShowDailyTable] = useState(false);

  return (
    <div className="space-y-8 print:space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("reports.pl.revenue")}      value={fmt(data.revenue)}      accent />
        <StatCard label={t("reports.pl.cogs")}         value={fmt(data.cogs)} />
        <StatCard
          label={t("reports.pl.grossProfit")}
          value={fmt(data.grossProfit)}
          sub={`${data.grossMarginPct}% ${t("reports.pl.margin")}`}
          accent
        />
        <StatCard label={t("reports.pl.taxCollected")} value={fmt(data.taxCollected)} />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t("reports.pl.orderCount")}    value={data.orderCount.toLocaleString()} />
        <StatCard label={t("reports.pl.avgOrderValue")} value={fmt(data.avgOrderValue)} />
      </div>

      {/* P&L statement */}
      <Section title={t("reports.pl.statement")}>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-600">{t("reports.pl.revenue")}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">{fmt(data.revenue)}</td>
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <td className="px-4 py-3 text-slate-500 pl-8">({t("reports.pl.cogs")})</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-600">({fmt(data.cogs)})</td>
              </tr>
              <tr className="bg-indigo-50 font-bold">
                <td className="px-4 py-3 text-indigo-800">{t("reports.pl.grossProfit")}</td>
                <td className="px-4 py-3 text-right tabular-nums text-indigo-700">{fmt(data.grossProfit)}</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500 text-xs">{t("reports.pl.grossMargin")}</td>
                <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-600">{data.grossMarginPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Revenue by order type */}
      {data.revenueByOrderType.length > 0 && (
        <Section title={t("reports.pl.byOrderType")}>
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            {data.revenueByOrderType.map((row) => (
              <BarRow key={row.orderType} label={orderTypeLabel(t, row.orderType)} value={row.revenue} total={totalRevenue} fmt={fmt} />
            ))}
          </div>
        </Section>
      )}

      {/* Daily revenue table */}
      {data.revenueByDay.length > 0 && (
        <Section title={t("reports.pl.dailyRevenue")}>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <button
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors print:hidden"
              onClick={() => setShowDailyTable((v) => !v)}
            >
              <span>{t("reports.pl.showDailyTable")} ({data.revenueByDay.length} {t("reports.pl.days")})</span>
              {showDailyTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {/* Always visible on print */}
            <div className={cn(showDailyTable ? "block" : "hidden", "print:block")}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-200">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t("reports.pl.date")}</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.pl.orders")}</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.pl.revenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.revenueByDay.map((row) => (
                    <tr key={row.date} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-slate-700">{formatDateLabel(row.date)}</td>
                      <td className="px-4 py-2 text-right text-slate-600 tabular-nums">{row.orderCount}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{fmt(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                    <td className="px-4 py-2 text-slate-700">{t("reports.total")}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{data.orderCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-900">{fmt(data.revenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Sales Summary report ──────────────────────────────────────────────────────

function SalesReport({ data }: { data: SalesSummary }) {
  const t = useT();
  const { fmt } = useCurrency();

  return (
    <div className="space-y-8 print:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("reports.sales.totalRevenue")} value={fmt(data.totalRevenue)} accent />
        <StatCard label={t("reports.sales.totalOrders")}  value={data.totalOrders.toLocaleString()} />
        <StatCard label={t("reports.sales.avgOrder")}     value={fmt(data.avgOrderValue)} />
      </div>

      {/* Top selling items */}
      {data.topItems.length > 0 && (
        <Section title={t("reports.sales.topItems")}>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">#</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t("reports.sales.item")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.sales.qty")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.sales.revenue")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">%</th>
                </tr>
              </thead>
              <tbody>
                {data.topItems.map((item, i) => (
                  <tr key={item.name} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-2 text-slate-400 tabular-nums text-xs">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{item.qty.toFixed(0)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(item.revenue)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-500 text-xs">
                      {data.totalRevenue > 0 ? ((item.revenue / data.totalRevenue) * 100).toFixed(0) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Revenue by order type */}
      {data.byOrderType.length > 0 && (
        <Section title={t("reports.sales.byOrderType")}>
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            {data.byOrderType.map((row) => (
              <BarRow key={row.orderType} label={orderTypeLabel(t, row.orderType)} value={row.revenue} total={data.totalRevenue} color="#10b981" fmt={fmt} />
            ))}
          </div>
        </Section>
      )}

      {/* Revenue by payment method */}
      {data.byPaymentMethod.length > 0 && (
        <Section title={t("reports.sales.byPayment")}>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t("reports.sales.method")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.sales.transactions")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.sales.tips")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.sales.revenue")}</th>
                </tr>
              </thead>
              <tbody>
                {data.byPaymentMethod.map((row) => (
                  <tr key={row.method} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2 font-medium text-slate-800">{paymentMethodLabel(t, row.method)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{row.count}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">{fmt(row.tips)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">{fmt(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Payroll report ────────────────────────────────────────────────────────────

function PayrollReportView({ data }: { data: PayrollReport }) {
  const t = useT();
  const { fmt } = useCurrency();
  const hasWages = data.employees.some((e) => e.hourlyRate !== null);

  return (
    <div className="space-y-8 print:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t("reports.payroll.totalHours")}   value={fmtHours(data.totals.totalMinutes)} />
        {hasWages && (
          <StatCard label={t("reports.payroll.totalWages")} value={fmt(data.totals.totalEstimatedWages)} accent />
        )}
        <StatCard label={t("reports.payroll.employees")} value={String(data.employees.length)} />
      </div>

      {/* Employee table */}
      <Section title={t("reports.payroll.breakdown")}>
        {data.employees.length === 0 ? (
          <p className="text-sm text-slate-500">{t("reports.payroll.noData")}</p>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t("reports.payroll.employee")}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t("reports.payroll.role")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.payroll.regularHrs")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.payroll.overtimeHrs")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.payroll.totalHrs")}</th>
                  {hasWages && <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.payroll.rate")}</th>}
                  {hasWages && <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.payroll.estWages")}</th>}
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.payroll.daysOff")}</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp) => {
                  const totalDaysOff = emp.daysOff.vacation + emp.daysOff.sick + emp.daysOff.personal + emp.daysOff.unpaid;
                  return (
                    <tr key={emp.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{emp.name}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{emp.roleName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{fmtHours(emp.regularMinutes)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-amber-600">
                        {emp.overtimeMinutes > 0 ? fmtHours(emp.overtimeMinutes) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{fmtHours(emp.totalMinutes)}</td>
                      {hasWages && (
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 text-xs">
                          {emp.hourlyRate ? fmt(emp.hourlyRate) : "—"}
                        </td>
                      )}
                      {hasWages && (
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                          {parseFloat(emp.estimatedWages) > 0 ? fmt(emp.estimatedWages) : "—"}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                        {totalDaysOff > 0 ? (
                          <span title={[
                            emp.daysOff.vacation > 0 && `${t("scheduling.timeOff.type.vacation")}: ${emp.daysOff.vacation}d`,
                            emp.daysOff.sick     > 0 && `${t("scheduling.timeOff.type.sick")}: ${emp.daysOff.sick}d`,
                            emp.daysOff.personal > 0 && `${t("scheduling.timeOff.type.personal")}: ${emp.daysOff.personal}d`,
                            emp.daysOff.unpaid   > 0 && `${t("scheduling.timeOff.type.unpaid")}: ${emp.daysOff.unpaid}d`,
                          ].filter(Boolean).join(" · ")}
                          >
                            {totalDaysOff}d
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {data.employees.length > 1 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                    <td className="px-4 py-2.5 text-slate-700" colSpan={2}>{t("reports.total")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700" colSpan={2} />
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{fmtHours(data.totals.totalMinutes)}</td>
                    {hasWages && <td className="px-4 py-2.5" />}
                    {hasWages && <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{fmt(data.totals.totalEstimatedWages)}</td>}
                    <td className="px-4 py-2.5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Section>

      {/* Time off breakdown */}
      {data.employees.some((e) => e.daysOff.vacation + e.daysOff.sick + e.daysOff.personal + e.daysOff.unpaid > 0) && (
        <Section title={t("reports.payroll.timeOffBreakdown")}>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t("reports.payroll.employee")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-amber-500">{t("scheduling.timeOff.type.vacation")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-red-500">{t("scheduling.timeOff.type.sick")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-blue-500">{t("scheduling.timeOff.type.personal")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("scheduling.timeOff.type.unpaid")}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t("reports.payroll.totalDays")}</th>
                </tr>
              </thead>
              <tbody>
                {data.employees
                  .filter((e) => e.daysOff.vacation + e.daysOff.sick + e.daysOff.personal + e.daysOff.unpaid > 0)
                  .map((emp) => (
                    <tr key={emp.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 font-medium text-slate-800">{emp.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-amber-600">{emp.daysOff.vacation || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-red-600">{emp.daysOff.sick     || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-blue-600">{emp.daysOff.personal || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{emp.daysOff.unpaid  || "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold text-slate-900">
                        {emp.daysOff.vacation + emp.daysOff.sick + emp.daysOff.personal + emp.daysOff.unpaid}
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const t = useT();
  const [selectedReport, setSelectedReport] = useState<ReportType>("profit-loss");
  const { from: defaultFrom, to: defaultTo } = useMemo(() => defaultDates(), []);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  const queryParams = `from=${fromDate}&to=${toDate}`;

  const plQuery = useQuery({
    queryKey: ["reports", "profit-loss", fromDate, toDate],
    queryFn: () => api.get(`/reports/profit-loss?${queryParams}`).then((r) => r.data as ProfitLoss),
    enabled: selectedReport === "profit-loss",
  });
  const salesQuery = useQuery({
    queryKey: ["reports", "sales", fromDate, toDate],
    queryFn: () => api.get(`/reports/sales-summary?${queryParams}`).then((r) => r.data as SalesSummary),
    enabled: selectedReport === "sales",
  });
  const payrollQuery = useQuery({
    queryKey: ["reports", "payroll", fromDate, toDate],
    queryFn: () => api.get(`/reports/payroll?${queryParams}`).then((r) => r.data as PayrollReport),
    enabled: selectedReport === "payroll",
  });

  const activeQuery = { "profit-loss": plQuery, sales: salesQuery, payroll: payrollQuery }[selectedReport];
  const isLoading = activeQuery.isLoading;
  const isError   = activeQuery.isError;

  const REPORT_TYPES: { key: ReportType; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { key: "profit-loss", label: t("reports.nav.profitLoss"), icon: TrendingUp,   desc: t("reports.nav.profitLossDesc") },
    { key: "sales",       label: t("reports.nav.sales"),      icon: ShoppingCart, desc: t("reports.nav.salesDesc") },
    { key: "payroll",     label: t("reports.nav.payroll"),    icon: Users,        desc: t("reports.nav.payrollDesc") },
  ];

  const reportTitles: Record<ReportType, string> = {
    "profit-loss": t("reports.nav.profitLoss"),
    sales: t("reports.nav.sales"),
    payroll: t("reports.nav.payroll"),
  };

  return (
    <>
      {/* Print-only header */}
      <div className="hidden print:block mb-6 pb-4 border-b border-slate-300">
        <h1 className="text-2xl font-bold text-slate-900">{reportTitles[selectedReport]}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {formatPeriodLabel(fromDate, toDate)}
        </p>
      </div>

      <div className="space-y-6 print:hidden">
        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("reports.title")}</h1>
            <p className="text-sm text-slate-500">{t("reports.subtitle")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            {t("reports.btn.print")}
          </Button>
        </div>
      </div>

      <div className="mt-6 flex gap-6 print:block">
        {/* Left: report type selector */}
        <div className="w-52 flex-shrink-0 space-y-1 print:hidden">
          {REPORT_TYPES.map((rt) => (
            <button
              key={rt.key}
              onClick={() => setSelectedReport(rt.key)}
              className={cn(
                "w-full text-left rounded-xl px-3 py-3 transition-colors",
                selectedReport === rt.key
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <div className="flex items-center gap-2.5">
                <rt.icon className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium">{rt.label}</span>
              </div>
              <p className={cn(
                "mt-0.5 ml-6 text-[11px] leading-tight",
                selectedReport === rt.key ? "text-slate-400" : "text-slate-400",
              )}>
                {rt.desc}
              </p>
            </button>
          ))}

          {/* Date range */}
          <div className="pt-4 space-y-3">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {t("reports.dateRange")}
            </p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="block text-xs text-slate-500">{t("reports.from")}</label>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-500">{t("reports.to")}</label>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: report content */}
        <div className="flex-1 min-w-0">
          {/* Period badge (screen) */}
          <div className="print:hidden mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {formatPeriodLabel(fromDate, toDate)}
              </span>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
            </div>
          )}

          {isError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {t("common.error")}
            </div>
          )}

          {!isLoading && !isError && (
            <>
              {selectedReport === "profit-loss" && plQuery.data && (
                <ProfitLossReport data={plQuery.data} />
              )}
              {selectedReport === "sales" && salesQuery.data && (
                <SalesReport data={salesQuery.data} />
              )}
              {selectedReport === "payroll" && payrollQuery.data && (
                <PayrollReportView data={payrollQuery.data} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
