import { Router } from "express";
import { db } from "@bizcore/db";
import {
  purchaseOrdersTable, purchaseOrderLinesTable,
  inventoryTransactionsTable, inventoryTable,
} from "@bizcore/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireModule, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { isLocationAllowed } from "../lib/access";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("purchasing")];

router.get("/purchase-orders", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db.select().from(purchaseOrdersTable)
      .where(tenantWhere(purchaseOrdersTable.businessId, businessId))
      .orderBy(desc(purchaseOrdersTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createPOSchema = z.object({
  locationId: z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  expectedAt: z.string().nullable().optional(),
  lines: z.array(z.object({
    variantId: z.string().uuid().nullable().optional(),
    description: z.string().min(1),
    quantity: z.string(),
    unitId: z.string().uuid().nullable().optional(),
    unitCost: z.string(),
  })).min(1),
});

router.post("/purchase-orders", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, userId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = createPOSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const [po] = await db.insert(purchaseOrdersTable).values({
      businessId,
      locationId: body.data.locationId,
      supplierId: body.data.supplierId ?? null,
      notes: body.data.notes ?? null,
      expectedAt: body.data.expectedAt ? new Date(body.data.expectedAt) : null,
      source: "manual",
      createdBy: userId,
    }).returning();

    await db.insert(purchaseOrderLinesTable).values(
      body.data.lines.map((l) => ({
        purchaseOrderId: po!.id,
        variantId: l.variantId ?? null,
        description: l.description,
        quantity: l.quantity,
        unitId: l.unitId ?? null,
        unitCost: l.unitCost,
        lineTotal: (parseFloat(l.quantity) * parseFloat(l.unitCost)).toFixed(2),
        matched: !!l.variantId,
      }))
    );

    res.status(201).json(po);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/purchase-orders/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [po] = await db.select().from(purchaseOrdersTable).where(
      and(eq(purchaseOrdersTable.id, req.params["id"] as string), tenantWhere(purchaseOrdersTable.businessId, businessId))
    );
    if (!po) { res.status(404).json({ error: "Not found" }); return; }
    const lines = await db.select().from(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.purchaseOrderId, po.id));
    res.json({ ...po, lines });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Receive PO — creates inventory transactions for matched lines
router.post("/purchase-orders/:id/receive", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const [po] = await db.select().from(purchaseOrdersTable).where(
      and(eq(purchaseOrdersTable.id, req.params["id"] as string), tenantWhere(purchaseOrdersTable.businessId, businessId))
    );
    if (!po) { res.status(404).json({ error: "Not found" }); return; }
    if (po.status === "received") { res.status(400).json({ error: "Already received" }); return; }

    await db.transaction(async (tx) => {
      const lines = await tx.select().from(purchaseOrderLinesTable).where(
        and(eq(purchaseOrderLinesTable.purchaseOrderId, po.id), eq(purchaseOrderLinesTable.matched, true))
      );

      for (const line of lines) {
        if (!line.variantId) continue;
        await tx.insert(inventoryTransactionsTable).values({
          variantId: line.variantId,
          locationId: po.locationId,
          type: "receive",
          quantityChange: line.quantity,
          unitId: line.unitId,
          referenceType: "purchase_order",
          referenceId: po.id,
          createdBy: userId,
        });
        await tx.insert(inventoryTable).values({ variantId: line.variantId, locationId: po.locationId, quantity: line.quantity })
          .onConflictDoUpdate({ target: [inventoryTable.variantId, inventoryTable.locationId], set: { quantity: sql`${inventoryTable.quantity} + ${line.quantity}::numeric` } });
      }

      await tx.update(purchaseOrdersTable).set({ status: "received", receivedAt: new Date() }).where(eq(purchaseOrdersTable.id, po.id));
    });

    res.json({ message: "Purchase order received and inventory updated" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Update line matching (used after AI review)
router.patch("/purchase-orders/:id/lines/:lineId", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [po] = await db.select({ id: purchaseOrdersTable.id }).from(purchaseOrdersTable).where(
      and(eq(purchaseOrdersTable.id, req.params["id"] as string), tenantWhere(purchaseOrdersTable.businessId, businessId))
    );
    if (!po) { res.status(404).json({ error: "Not found" }); return; }

    const body = z.object({ variantId: z.string().uuid().nullable().optional(), matched: z.boolean().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [row] = await db.update(purchaseOrderLinesTable).set({
      variantId: body.data.variantId,
      matched: body.data.matched ?? (body.data.variantId !== null),
    }).where(
      and(eq(purchaseOrderLinesTable.id, req.params["lineId"] as string), eq(purchaseOrderLinesTable.purchaseOrderId, po.id))
    ).returning();
    if (!row) { res.status(404).json({ error: "Line not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
