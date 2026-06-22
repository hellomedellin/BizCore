import { Router } from "express";
import { db } from "@bizcore/db";
import { cashReconciliationsTable, paymentsTable } from "@bizcore/db/schema";
import { eq, and, gt, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { isLocationAllowed } from "../lib/access";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("orders")];

// Sum of completed cash payments at a location since a given time (or all time).
async function expectedCashSince(businessId: string, locationId: string, since: Date | null): Promise<string> {
  const conds = [
    tenantWhere(paymentsTable.businessId, businessId),
    eq(paymentsTable.locationId, locationId),
    eq(paymentsTable.method, "cash"),
    eq(paymentsTable.status, "completed"),
  ];
  if (since) conds.push(gt(paymentsTable.processedAt, since));
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${paymentsTable.amount}), 0)` })
    .from(paymentsTable)
    .where(and(...conds));
  return row?.total ?? "0";
}

// List past reconciliations for a location + the expected cash for the next one.
router.get("/cash-reconciliations", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const locationId = req.query["locationId"] as string | undefined;
    if (!locationId) { res.status(400).json({ error: "locationId is required" }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const history = await db
      .select()
      .from(cashReconciliationsTable)
      .where(and(tenantWhere(cashReconciliationsTable.businessId, businessId), eq(cashReconciliationsTable.locationId, locationId)))
      .orderBy(desc(cashReconciliationsTable.closedAt))
      .limit(30);

    const since = history[0]?.closedAt ?? null;
    const expectedNow = await expectedCashSince(businessId, locationId, since ? new Date(since) : null);

    res.json({ history, expectedNow, since });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createSchema = z.object({
  locationId: z.string().uuid(),
  countedCash: z.string(),
  denominations: z.record(z.number()).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Record a cash count. Server recomputes expected (so the client can't fudge it).
router.post("/cash-reconciliations", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, userId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = createSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const [last] = await db
      .select({ closedAt: cashReconciliationsTable.closedAt })
      .from(cashReconciliationsTable)
      .where(and(tenantWhere(cashReconciliationsTable.businessId, businessId), eq(cashReconciliationsTable.locationId, body.data.locationId)))
      .orderBy(desc(cashReconciliationsTable.closedAt))
      .limit(1);

    const openedAt = last?.closedAt ?? null;
    const expected = await expectedCashSince(businessId, body.data.locationId, openedAt ? new Date(openedAt) : null);
    const variance = (parseFloat(body.data.countedCash) - parseFloat(expected)).toFixed(2);

    const [row] = await db.insert(cashReconciliationsTable).values({
      businessId,
      locationId: body.data.locationId,
      openedAt,
      expectedCash: expected,
      countedCash: parseFloat(body.data.countedCash).toFixed(2),
      variance,
      denominations: body.data.denominations ? JSON.stringify(body.data.denominations) : null,
      notes: body.data.notes ?? null,
      createdBy: userId,
    }).returning();

    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
