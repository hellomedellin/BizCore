import { Router, type IRouter } from "express";
import { eq, and, gte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  ordersTable,
  employeesTable,
  inventoryTable,
  timeEntriesTable,
} from "@workspace/db";
import { requireAuth, loadBusiness, type AuthedRequest } from "../middlewares/auth";
import { GetDashboardSummaryResponse, GetDashboardSummaryQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayOrders] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(total::numeric), 0)`,
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.businessId, businessId),
          gte(ordersTable.createdAt, today),
          sql`${ordersTable.status} != 'cancelled'`,
        ),
      );

    const [monthOrders] = await db
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(total::numeric), 0)`,
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.businessId, businessId),
          gte(ordersTable.createdAt, firstOfMonth),
          sql`${ordersTable.status} != 'cancelled'`,
        ),
      );

    const [activeEmployeesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employeesTable)
      .where(
        and(
          eq(employeesTable.businessId, businessId),
          eq(employeesTable.active, true),
        ),
      );

    const [lowStockResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inventoryTable)
      .where(
        sql`${inventoryTable.quantity}::numeric <= ${inventoryTable.lowStockThreshold}::numeric AND ${inventoryTable.lowStockThreshold} IS NOT NULL`,
      );

    const [pendingTimeResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(timeEntriesTable)
      .where(
        and(
          eq(timeEntriesTable.status, "pending"),
          sql`${timeEntriesTable.clockOut} IS NOT NULL`,
        ),
      );

    const recentOrders = await db
      .select({
        id: ordersTable.id,
        status: ordersTable.status,
        total: ordersTable.total,
        orderType: ordersTable.orderType,
        createdAt: ordersTable.createdAt,
      })
      .from(ordersTable)
      .where(eq(ordersTable.businessId, businessId))
      .orderBy(sql`${ordersTable.createdAt} DESC`)
      .limit(5);

    res.json(
      GetDashboardSummaryResponse.parse({
        totalOrdersToday: todayOrders?.count ?? 0,
        totalSalesToday: Number(todayOrders?.total ?? 0),
        totalOrdersMonth: monthOrders?.count ?? 0,
        totalSalesMonth: Number(monthOrders?.total ?? 0),
        activeEmployees: activeEmployeesResult?.count ?? 0,
        lowStockItems: lowStockResult?.count ?? 0,
        pendingTimeEntries: pendingTimeResult?.count ?? 0,
        recentOrders: recentOrders.map((o) => ({
          ...o,
          total: String(o.total),
        })),
      }),
    );
  },
);

export default router;
