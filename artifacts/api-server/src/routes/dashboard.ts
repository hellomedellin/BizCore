import { Router } from "express";
import { db } from "@bizcore/db";
import {
  ordersTable, inventoryTable, itemVariantsTable, itemsTable,
  shiftsTable, employeesTable, employeeRolesTable, timeEntriesTable, timeOffRequestsTable,
} from "@bizcore/db/schema";
import { eq, and, gte, lt, inArray, sql, isNotNull } from "drizzle-orm";
import { requireAuth, loadBusiness, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { isLocationAllowed } from "../lib/access";

const router = Router();
const guard = [requireAuth, loadBusiness];

// One bundled "morning briefing" for the dashboard: today's revenue vs the same
// weekday last week, active orders, low-stock items, who's on today, and
// pending approvals. The client passes today's [from,to) in its local timezone;
// the prior-week window is derived by subtracting 7 days. On-demand, no cron.
router.get("/dashboard/briefing", ...guard, async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const locationId = req.query["locationId"] as string | undefined;
    if (locationId && !(await isLocationAllowed(db, businessId, allowedLocationIds, locationId))) {
      res.status(403).json({ error: "Location not allowed" }); return;
    }

    const to = req.query["to"] ? new Date(req.query["to"] as string) : new Date();
    const from = req.query["from"] ? new Date(req.query["from"] as string) : new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const prevFrom = new Date(from.getTime() - WEEK);
    const prevTo = new Date(to.getTime() - WEEK);

    const locOrders = locationId ? [eq(ordersTable.locationId, locationId)] : [];

    const [todayRev] = await db
      .select({
        revenue: sql<string>`coalesce(sum(${ordersTable.total}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(ordersTable)
      .where(and(
        tenantWhere(ordersTable.businessId, businessId),
        eq(ordersTable.status, "completed"),
        gte(ordersTable.completedAt, from),
        lt(ordersTable.completedAt, to),
        ...locOrders,
      ));

    const [prevRev] = await db
      .select({ revenue: sql<string>`coalesce(sum(${ordersTable.total}), 0)` })
      .from(ordersTable)
      .where(and(
        tenantWhere(ordersTable.businessId, businessId),
        eq(ordersTable.status, "completed"),
        gte(ordersTable.completedAt, prevFrom),
        lt(ordersTable.completedAt, prevTo),
        ...locOrders,
      ));

    const [active] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ordersTable)
      .where(and(
        tenantWhere(ordersTable.businessId, businessId),
        inArray(ordersTable.status, ["pending", "confirmed", "in_progress", "ready"]),
        ...locOrders,
      ));

    const lowStock = await db
      .select({
        name: itemsTable.name,
        quantity: inventoryTable.quantity,
        threshold: inventoryTable.lowStockThreshold,
      })
      .from(inventoryTable)
      .innerJoin(itemVariantsTable, eq(inventoryTable.variantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(and(
        tenantWhere(itemsTable.businessId, businessId),
        eq(itemsTable.active, true),
        isNotNull(inventoryTable.lowStockThreshold),
        sql`${inventoryTable.quantity} <= ${inventoryTable.lowStockThreshold}`,
        ...(locationId ? [eq(inventoryTable.locationId, locationId)] : []),
      ))
      .orderBy(itemsTable.name);

    const staffToday = await db
      .select({
        employeeName: employeesTable.name,
        roleName: employeeRolesTable.name,
        roleColor: employeeRolesTable.color,
        startTime: shiftsTable.startTime,
        endTime: shiftsTable.endTime,
      })
      .from(shiftsTable)
      .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
      .leftJoin(employeeRolesTable, eq(employeesTable.roleId, employeeRolesTable.id))
      .where(and(
        tenantWhere(employeesTable.businessId, businessId),
        lt(shiftsTable.startTime, to),
        gte(shiftsTable.endTime, from),
        ...(locationId ? [eq(shiftsTable.locationId, locationId)] : []),
      ))
      .orderBy(shiftsTable.startTime);

    const [pendingTE] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(timeEntriesTable)
      .innerJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .where(and(tenantWhere(employeesTable.businessId, businessId), eq(timeEntriesTable.status, "pending")));

    const [pendingTO] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(timeOffRequestsTable)
      .innerJoin(employeesTable, eq(timeOffRequestsTable.employeeId, employeesTable.id))
      .where(and(tenantWhere(employeesTable.businessId, businessId), eq(timeOffRequestsTable.status, "pending")));

    res.json({
      revenueToday: todayRev?.revenue ?? "0",
      revenuePrevWeek: prevRev?.revenue ?? "0",
      ordersToday: todayRev?.count ?? 0,
      activeOrders: active?.count ?? 0,
      lowStock,
      staffToday,
      pendingTimeEntries: pendingTE?.count ?? 0,
      pendingTimeOff: pendingTO?.count ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
