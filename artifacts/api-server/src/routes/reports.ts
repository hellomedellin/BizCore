import { Router } from "express";
import { db } from "@bizcore/db";
import { sql } from "drizzle-orm";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";

const router = Router();
const guard = [requireAuth, loadBusiness, requireRole("admin", "manager", "accountant")];

function parseDates(from: unknown, to: unknown): { from: string; to: string } | null {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof from !== "string" || typeof to !== "string") return null;
  if (!re.test(from) || !re.test(to)) return null;
  return { from, to };
}

// ── GET /reports/profit-loss ──────────────────────────────────────────────────
router.get("/reports/profit-loss", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  const dates = parseDates(req.query.from, req.query.to);
  if (!dates) { res.status(400).json({ error: "Provide from and to as YYYY-MM-DD" }); return; }

  try {
    // Revenue & tax from completed orders
    const [rev] = (await db.execute(sql`
      SELECT
        COALESCE(SUM(total::numeric),    0) AS revenue,
        COALESCE(SUM(tax::numeric),      0) AS tax_collected,
        COALESCE(SUM(subtotal::numeric), 0) AS subtotal,
        COUNT(*) AS order_count,
        COALESCE(AVG(total::numeric),    0) AS avg_order_value
      FROM orders
      WHERE business_id = ${businessId}
        AND status = 'completed'
        AND COALESCE(completed_at, created_at) >= ${dates.from}::date
        AND COALESCE(completed_at, created_at) <  (${dates.to}::date + interval '1 day')
    `)).rows as any[];

    // COGS = sum of received purchase order lines
    const [cogs] = (await db.execute(sql`
      SELECT COALESCE(SUM(pol.line_total::numeric), 0) AS cogs
      FROM purchase_order_lines pol
      INNER JOIN purchase_orders po ON pol.purchase_order_id = po.id
      WHERE po.business_id = ${businessId}
        AND po.status     = 'received'
        AND po.received_at >= ${dates.from}::date
        AND po.received_at <  (${dates.to}::date + interval '1 day')
    `)).rows as any[];

    // Revenue by day
    const byDay = (await db.execute(sql`
      SELECT
        DATE(COALESCE(completed_at, created_at)) AS day,
        COALESCE(SUM(total::numeric), 0) AS revenue,
        COUNT(*) AS order_count
      FROM orders
      WHERE business_id = ${businessId}
        AND status = 'completed'
        AND COALESCE(completed_at, created_at) >= ${dates.from}::date
        AND COALESCE(completed_at, created_at) <  (${dates.to}::date + interval '1 day')
      GROUP BY day
      ORDER BY day
    `)).rows as any[];

    // Revenue by order type
    const byType = (await db.execute(sql`
      SELECT
        order_type,
        COALESCE(SUM(total::numeric), 0) AS revenue,
        COUNT(*) AS order_count
      FROM orders
      WHERE business_id = ${businessId}
        AND status = 'completed'
        AND COALESCE(completed_at, created_at) >= ${dates.from}::date
        AND COALESCE(completed_at, created_at) <  (${dates.to}::date + interval '1 day')
      GROUP BY order_type
      ORDER BY revenue DESC
    `)).rows as any[];

    const revenue    = parseFloat(rev?.revenue     ?? "0");
    const cogsAmt    = parseFloat(cogs?.cogs       ?? "0");
    const grossProfit = revenue - cogsAmt;

    res.json({
      period: dates,
      revenue:       revenue.toFixed(2),
      cogs:          cogsAmt.toFixed(2),
      grossProfit:   grossProfit.toFixed(2),
      grossMarginPct: revenue > 0 ? parseFloat(((grossProfit / revenue) * 100).toFixed(1)) : 0,
      orderCount:    parseInt(rev?.order_count     ?? "0"),
      avgOrderValue: parseFloat(parseFloat(rev?.avg_order_value ?? "0").toFixed(2)),
      taxCollected:  parseFloat(parseFloat(rev?.tax_collected   ?? "0").toFixed(2)),
      revenueByDay: byDay.map((r) => ({
        date:       String(r.day).slice(0, 10),
        revenue:    parseFloat(r.revenue),
        orderCount: parseInt(r.order_count),
      })),
      revenueByOrderType: byType.map((r) => ({
        orderType:  r.order_type,
        revenue:    parseFloat(r.revenue),
        orderCount: parseInt(r.order_count),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ── GET /reports/sales-summary ────────────────────────────────────────────────
router.get("/reports/sales-summary", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  const dates = parseDates(req.query.from, req.query.to);
  if (!dates) { res.status(400).json({ error: "Provide from and to as YYYY-MM-DD" }); return; }

  try {
    // Top items by revenue
    const topItems = (await db.execute(sql`
      SELECT
        ol.name,
        COALESCE(SUM(ol.quantity::numeric),   0) AS total_qty,
        COALESCE(SUM(ol.line_total::numeric), 0) AS total_revenue
      FROM order_lines ol
      INNER JOIN orders o ON ol.order_id = o.id
      WHERE o.business_id = ${businessId}
        AND o.status = 'completed'
        AND COALESCE(o.completed_at, o.created_at) >= ${dates.from}::date
        AND COALESCE(o.completed_at, o.created_at) <  (${dates.to}::date + interval '1 day')
      GROUP BY ol.name
      ORDER BY total_revenue DESC
      LIMIT 15
    `)).rows as any[];

    // Revenue by payment method
    const byPayment = (await db.execute(sql`
      SELECT
        p.method,
        COALESCE(SUM(p.amount::numeric), 0) AS revenue,
        COALESCE(SUM(p.tip::numeric),    0) AS tips,
        COUNT(*) AS count
      FROM payments p
      WHERE p.business_id = ${businessId}
        AND p.status = 'completed'
        AND p.processed_at >= ${dates.from}::date
        AND p.processed_at <  (${dates.to}::date + interval '1 day')
      GROUP BY p.method
      ORDER BY revenue DESC
    `)).rows as any[];

    // Order type breakdown
    const byType = (await db.execute(sql`
      SELECT
        order_type,
        COALESCE(SUM(total::numeric), 0) AS revenue,
        COUNT(*) AS order_count
      FROM orders
      WHERE business_id = ${businessId}
        AND status = 'completed'
        AND COALESCE(completed_at, created_at) >= ${dates.from}::date
        AND COALESCE(completed_at, created_at) <  (${dates.to}::date + interval '1 day')
      GROUP BY order_type
      ORDER BY revenue DESC
    `)).rows as any[];

    // Summary totals
    const [totals] = (await db.execute(sql`
      SELECT
        COALESCE(SUM(total::numeric), 0) AS total_revenue,
        COUNT(*) AS total_orders,
        COALESCE(AVG(total::numeric), 0) AS avg_order_value
      FROM orders
      WHERE business_id = ${businessId}
        AND status = 'completed'
        AND COALESCE(completed_at, created_at) >= ${dates.from}::date
        AND COALESCE(completed_at, created_at) <  (${dates.to}::date + interval '1 day')
    `)).rows as any[];

    res.json({
      period: dates,
      totalRevenue:  parseFloat(parseFloat(totals?.total_revenue  ?? "0").toFixed(2)),
      totalOrders:   parseInt(totals?.total_orders   ?? "0"),
      avgOrderValue: parseFloat(parseFloat(totals?.avg_order_value ?? "0").toFixed(2)),
      topItems: topItems.map((r) => ({
        name:    r.name,
        qty:     parseFloat(r.total_qty),
        revenue: parseFloat(r.total_revenue),
      })),
      byPaymentMethod: byPayment.map((r) => ({
        method:  r.method,
        revenue: parseFloat(r.revenue),
        tips:    parseFloat(r.tips),
        count:   parseInt(r.count),
      })),
      byOrderType: byType.map((r) => ({
        orderType:  r.order_type,
        revenue:    parseFloat(r.revenue),
        orderCount: parseInt(r.order_count),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ── GET /reports/payroll ──────────────────────────────────────────────────────
router.get("/reports/payroll", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  const dates = parseDates(req.query.from, req.query.to);
  if (!dates) { res.status(400).json({ error: "Provide from and to as YYYY-MM-DD" }); return; }

  try {
    // Hours worked per employee (approved time entries)
    const empHours = (await db.execute(sql`
      SELECT
        e.id,
        e.name,
        e.hourly_rate,
        e.overtime_rate_multiplier,
        r.name AS role_name,
        COALESCE(SUM(CASE WHEN te.entry_type = 'regular'   THEN te.total_minutes ELSE 0 END), 0) AS regular_minutes,
        COALESCE(SUM(CASE WHEN te.entry_type = 'overtime'  THEN te.total_minutes ELSE 0 END), 0) AS overtime_minutes,
        COALESCE(SUM(te.total_minutes), 0) AS total_minutes
      FROM employees e
      LEFT JOIN employee_roles r  ON r.id = e.role_id
      LEFT JOIN time_entries   te ON te.employee_id = e.id
        AND te.status   = 'approved'
        AND te.clock_in >= ${dates.from}::date
        AND te.clock_in <  (${dates.to}::date + interval '1 day')
      WHERE e.business_id = ${businessId}
        AND e.active = true
      GROUP BY e.id, e.name, e.hourly_rate, e.overtime_rate_multiplier, r.name
      ORDER BY e.name
    `)).rows as any[];

    // Time off days per employee in the period
    const timeOff = (await db.execute(sql`
      SELECT
        tor.employee_id,
        tor.request_type,
        SUM(
          LEAST(tor.end_date::date, ${dates.to}::date)
          - GREATEST(tor.start_date::date, ${dates.from}::date)
          + 1
        ) AS days_off
      FROM time_off_requests tor
      INNER JOIN employees e ON e.id = tor.employee_id
      WHERE e.business_id = ${businessId}
        AND tor.status     = 'approved'
        AND tor.end_date   >= ${dates.from}::date
        AND tor.start_date <= ${dates.to}::date
      GROUP BY tor.employee_id, tor.request_type
    `)).rows as any[];

    // Build time-off map
    const timeOffMap = new Map<string, Record<string, number>>();
    for (const row of timeOff) {
      if (!timeOffMap.has(row.employee_id)) {
        timeOffMap.set(row.employee_id, { vacation: 0, sick: 0, personal: 0, unpaid: 0 });
      }
      const entry = timeOffMap.get(row.employee_id)!;
      entry[row.request_type as string] = parseInt(row.days_off);
    }

    let totalEstimatedWages = 0;
    let totalMinutes = 0;

    const employees = empHours.map((e) => {
      const regularHours  = parseInt(e.regular_minutes)  / 60;
      const overtimeHours = parseInt(e.overtime_minutes) / 60;
      const rate          = parseFloat(e.hourly_rate     ?? "0");
      const overtimeMult  = parseFloat(e.overtime_rate_multiplier ?? "1.5");
      const wages = rate > 0
        ? (regularHours * rate) + (overtimeHours * rate * overtimeMult)
        : 0;

      totalEstimatedWages += wages;
      totalMinutes += parseInt(e.total_minutes);

      return {
        id:              e.id,
        name:            e.name,
        roleName:        e.role_name ?? null,
        regularMinutes:  parseInt(e.regular_minutes),
        overtimeMinutes: parseInt(e.overtime_minutes),
        totalMinutes:    parseInt(e.total_minutes),
        hourlyRate:      e.hourly_rate ? parseFloat(e.hourly_rate).toFixed(2) : null,
        estimatedWages:  wages.toFixed(2),
        daysOff: {
          vacation: timeOffMap.get(e.id)?.vacation ?? 0,
          sick:     timeOffMap.get(e.id)?.sick     ?? 0,
          personal: timeOffMap.get(e.id)?.personal ?? 0,
          unpaid:   timeOffMap.get(e.id)?.unpaid   ?? 0,
        },
      };
    });

    res.json({
      period: dates,
      employees,
      totals: {
        totalMinutes,
        totalEstimatedWages: totalEstimatedWages.toFixed(2),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
