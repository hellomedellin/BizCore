import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ordersTable,
  employeesTable,
  inventoryTable,
  timeEntriesTable,
  locationsTable,
} from "@workspace/db";
import { requireAuth, loadBusiness, type AuthedRequest } from "../middlewares/auth";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function getPeriodDates(period: string | undefined): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case "week": {
      const start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end };
    }
    case "today":
    default: {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
  }
}

router.get(
  "/dashboard/summary",
  requireAuth,
  loadBusiness,
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.json(
        GetDashboardSummaryResponse.parse({
          totalOrdersToday: 0,
          totalSalesToday: 0,
          totalOrdersMonth: 0,
          totalSalesMonth: 0,
          activeEmployees: 0,
          lowStockItems: 0,
          pendingTimeEntries: 0,
          recentOrders: [],
        }),
      );
      return;
    }

    const businessId = authedReq.businessId;
    const period = req.query.period as string | undefined;
    const locationIdParam = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;

    const { start: periodStart, end: periodEnd } = getPeriodDates(period);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Get all location IDs for this business
    const businessLocations = await db
      .select({ id: locationsTable.id })
      .from(locationsTable)
      .where(eq(locationsTable.businessId, businessId));
    const locationIds = businessLocations.map((l) => l.id);

    // Build location filter for orders
    const orderLocationCondition = locationIdParam
      ? eq(ordersTable.locationId, locationIdParam)
      : undefined;

    // Period-scoped order metrics (replaces "today" slot when a period is selected)
    const periodConditions = [
      eq(ordersTable.businessId, businessId),
      gte(ordersTable.createdAt, periodStart),
      lte(ordersTable.createdAt, periodEnd),
      sql`${ordersTable.status} != 'cancelled'`,
      ...(orderLocationCondition ? [orderLocationCondition] : []),
    ];

    const [periodOrders] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${ordersTable.total}::numeric), 0)`,
      })
      .from(ordersTable)
      .where(and(...periodConditions));

    // Always compute month totals for comparison (business-wide unless filtered by location)
    const monthConditions = [
      eq(ordersTable.businessId, businessId),
      gte(ordersTable.createdAt, firstOfMonth),
      sql`${ordersTable.status} != 'cancelled'`,
      ...(orderLocationCondition ? [orderLocationCondition] : []),
    ];

    const [monthOrders] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${ordersTable.total}::numeric), 0)`,
      })
      .from(ordersTable)
      .where(and(...monthConditions));

    // Get all employee IDs for this business
    const businessEmployees = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(eq(employeesTable.businessId, businessId));
    const employeeIds = businessEmployees.map((e) => e.id);

    const [activeEmployeesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.businessId, businessId),
          eq(employeesTable.active, true),
        ),
      );

    // Low stock: scope by location if filter applied
    const stockLocationIds = locationIdParam ? [locationIdParam] : locationIds;
    let lowStockCount = 0;
    if (stockLocationIds.length > 0) {
      const [lowStockResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(inventoryTable)
        .where(
          and(
            inArray(inventoryTable.locationId, stockLocationIds),
            sql`${inventoryTable.quantity}::numeric <= ${inventoryTable.lowStockThreshold}::numeric`,
            sql`${inventoryTable.lowStockThreshold} IS NOT NULL`,
          ),
        );
      lowStockCount = lowStockResult?.count ?? 0;
    }

    // Pending time entries
    let pendingTimeCount = 0;
    if (employeeIds.length > 0) {
      const [pendingTimeResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(timeEntriesTable)
        .where(
          and(
            inArray(timeEntriesTable.employeeId, employeeIds),
            eq(timeEntriesTable.status, "pending"),
            sql`${timeEntriesTable.clockOut} IS NOT NULL`,
          ),
        );
      pendingTimeCount = pendingTimeResult?.count ?? 0;
    }

    // Recent orders (scoped to location if filter applied)
    const recentOrdersConditions = [
      eq(ordersTable.businessId, businessId),
      ...(orderLocationCondition ? [orderLocationCondition] : []),
    ];

    const recentOrders = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        total: ordersTable.total,
        orderType: ordersTable.orderType,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .where(and(...recentOrdersConditions))
      .orderBy(sql`${ordersTable.createdAt} DESC`)
      .limit(5);

    res.json(
      GetDashboardSummaryResponse.parse({
        totalOrdersToday: periodOrders?.count ?? 0,
        totalSalesToday: Number(periodOrders?.total ?? 0),
        totalOrdersMonth: monthOrders?.count ?? 0,
        totalSalesMonth: Number(monthOrders?.total ?? 0),
        activeEmployees: activeEmployeesResult?.count ?? 0,
        lowStockItems: lowStockCount,
        pendingTimeEntries: pendingTimeCount,
        recentOrders: recentOrders.map((o) => ({
          ...o,
          total: String(o.total),
        })),
      }),
    );
  },
);

export default router;
