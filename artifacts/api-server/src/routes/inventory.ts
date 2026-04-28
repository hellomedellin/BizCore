import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  inventoryTable,
  inventoryTransactionsTable,
  itemVariantsTable,
  itemsTable,
  categoriesTable,
  locationsTable,
} from "@workspace/db/schema";
import { eq, and, ilike, sql, SQL, desc } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

router.get("/inventory", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const locationId = parseInt(req.query.locationId as string);
    if (isNaN(locationId)) {
      res.status(400).json({ error: "locationId is required" });
      return;
    }

    const conditions: SQL[] = [
      eq(inventoryTable.locationId, locationId),
      tenantWhere(itemsTable.businessId, businessId!),
      tenantWhere(locationsTable.businessId, businessId!),
    ];
    if (req.query.search && typeof req.query.search === "string") {
      conditions.push(ilike(itemsTable.name, `%${req.query.search.trim()}%`));
    }
    if (req.query.categoryId && !isNaN(parseInt(req.query.categoryId as string))) {
      conditions.push(eq(itemsTable.categoryId, parseInt(req.query.categoryId as string)));
    }

    const rows = await db
      .select({
        id: inventoryTable.id,
        variantId: inventoryTable.variantId,
        locationId: inventoryTable.locationId,
        quantity: inventoryTable.quantity,
        lowStockThreshold: inventoryTable.lowStockThreshold,
        itemId: itemsTable.id,
        itemName: itemsTable.name,
        variantName: itemVariantsTable.name,
        sku: itemVariantsTable.sku,
        categoryId: itemsTable.categoryId,
        categoryName: categoriesTable.name,
      })
      .from(inventoryTable)
      .innerJoin(itemVariantsTable, eq(inventoryTable.variantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .innerJoin(locationsTable, eq(inventoryTable.locationId, locationsTable.id))
      .where(and(...conditions))
      .orderBy(itemsTable.name, itemVariantsTable.name);

    const result = rows.map((r) => ({
      ...r,
      isLowStock:
        r.lowStockThreshold !== null &&
        parseFloat(r.quantity) < parseFloat(r.lowStockThreshold),
    }));

    if (req.query.lowStock === "true") {
      res.json(result.filter((r) => r.isLowStock));
      return;
    }

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

router.get("/inventory/low-stock", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : null;

    const baseConditions: SQL[] = [
      tenantWhere(itemsTable.businessId, businessId!),
      tenantWhere(locationsTable.businessId, businessId!),
      sql`${inventoryTable.lowStockThreshold} IS NOT NULL`,
      sql`CAST(${inventoryTable.quantity} AS NUMERIC) < CAST(${inventoryTable.lowStockThreshold} AS NUMERIC)`,
    ];
    if (locationId !== null && !isNaN(locationId)) {
      baseConditions.push(eq(inventoryTable.locationId, locationId));
    }

    const rows = await db
      .select({
        id: inventoryTable.id,
        variantId: inventoryTable.variantId,
        locationId: inventoryTable.locationId,
        quantity: inventoryTable.quantity,
        lowStockThreshold: inventoryTable.lowStockThreshold,
        itemId: itemsTable.id,
        itemName: itemsTable.name,
        variantName: itemVariantsTable.name,
        sku: itemVariantsTable.sku,
        categoryId: itemsTable.categoryId,
        categoryName: categoriesTable.name,
      })
      .from(inventoryTable)
      .innerJoin(itemVariantsTable, eq(inventoryTable.variantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .innerJoin(locationsTable, eq(inventoryTable.locationId, locationsTable.id))
      .where(and(...baseConditions))
      .orderBy(itemsTable.name);

    res.json(rows.map((r) => ({ ...r, isLowStock: true })));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

router.get("/inventory/transactions", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : null;
    const variantId = req.query.variantId ? parseInt(req.query.variantId as string) : null;

    const conditions: SQL[] = [
      tenantWhere(itemsTable.businessId, businessId!),
      tenantWhere(locationsTable.businessId, businessId!),
    ];
    if (locationId !== null && !isNaN(locationId)) {
      conditions.push(eq(inventoryTransactionsTable.locationId, locationId));
    }
    if (variantId !== null && !isNaN(variantId)) {
      conditions.push(eq(inventoryTransactionsTable.variantId, variantId));
    }

    const rows = await db
      .select({
        id: inventoryTransactionsTable.id,
        variantId: inventoryTransactionsTable.variantId,
        locationId: inventoryTransactionsTable.locationId,
        type: inventoryTransactionsTable.type,
        quantityChange: inventoryTransactionsTable.quantityChange,
        referenceType: inventoryTransactionsTable.referenceType,
        referenceId: inventoryTransactionsTable.referenceId,
        batchId: inventoryTransactionsTable.batchId,
        notes: inventoryTransactionsTable.notes,
        createdBy: inventoryTransactionsTable.createdBy,
        createdAt: inventoryTransactionsTable.createdAt,
        itemName: itemsTable.name,
        variantName: itemVariantsTable.name,
      })
      .from(inventoryTransactionsTable)
      .innerJoin(itemVariantsTable, eq(inventoryTransactionsTable.variantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .innerJoin(locationsTable, eq(inventoryTransactionsTable.locationId, locationsTable.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryTransactionsTable.createdAt))
      .limit(limit);

    res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

const createTransactionSchema = z.object({
  variantId: z.number().int(),
  locationId: z.number().int(),
  type: z.enum(["purchase", "adjustment", "waste", "return", "transfer", "sale"]),
  quantityChange: z.string(),
  notes: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
});

router.post("/inventory/transactions", requireAuth, loadBusiness, requireRole("admin", "manager", "cashier"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const userId = authedReq.userId;

    const body = createTransactionSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [location] = await db
      .select({ id: locationsTable.id })
      .from(locationsTable)
      .where(and(eq(locationsTable.id, body.data.locationId), tenantWhere(locationsTable.businessId, businessId!)));
    if (!location) {
      res.status(400).json({ error: "Location not found or not in your business" });
      return;
    }

    const [variant] = await db
      .select({ id: itemVariantsTable.id, itemId: itemVariantsTable.itemId })
      .from(itemVariantsTable)
      .where(eq(itemVariantsTable.id, body.data.variantId));
    if (!variant) {
      res.status(400).json({ error: "Variant not found" });
      return;
    }

    const [item] = await db
      .select({ id: itemsTable.id })
      .from(itemsTable)
      .where(and(eq(itemsTable.id, variant.itemId), tenantWhere(itemsTable.businessId, businessId!)));
    if (!item) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const [txn] = await db
      .insert(inventoryTransactionsTable)
      .values({ ...body.data, createdBy: userId ?? null })
      .returning();

    await db
      .insert(inventoryTable)
      .values({
        variantId: body.data.variantId,
        locationId: body.data.locationId,
        quantity: body.data.quantityChange,
      })
      .onConflictDoUpdate({
        target: [inventoryTable.variantId, inventoryTable.locationId],
        set: {
          quantity: sql`${inventoryTable.quantity} + CAST(${body.data.quantityChange} AS NUMERIC)`,
          updatedAt: new Date(),
        },
      });

    res.status(201).json(txn);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

export default router;
