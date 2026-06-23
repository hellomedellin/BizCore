import { Router } from "express";
import { db } from "@bizcore/db";
import {
  inventoryTable, inventoryTransactionsTable, itemVariantsTable, itemsTable,
  categoriesTable, locationsTable, unitsTable,
} from "@bizcore/db/schema";
import { eq, and, ilike, sql, SQL, desc, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { isLocationAllowed } from "../lib/access";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("inventory")];

router.get("/inventory", ...guard, async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const locationId = req.query["locationId"] as string | undefined;
    if (!locationId) { res.status(400).json({ error: "locationId is required" }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const conditions: SQL[] = [
      eq(inventoryTable.locationId, locationId),
      tenantWhere(itemsTable.businessId, businessId),
    ];
    if (req.query["search"]) conditions.push(ilike(itemsTable.name, `%${req.query["search"]}%`));
    if (req.query["categoryId"]) conditions.push(eq(itemsTable.categoryId, req.query["categoryId"] as string));
    if (req.query["type"]) conditions.push(eq(itemsTable.type, req.query["type"] as any));

    const rows = await db
      .select({
        id: inventoryTable.id,
        variantId: inventoryTable.variantId,
        locationId: inventoryTable.locationId,
        quantity: inventoryTable.quantity,
        unitId: inventoryTable.unitId,
        unitAbbreviation: unitsTable.abbreviation,
        lowStockThreshold: inventoryTable.lowStockThreshold,
        itemId: itemsTable.id,
        itemName: itemsTable.name,
        itemType: itemsTable.type,
        variantName: itemVariantsTable.name,
        sku: itemVariantsTable.sku,
        categoryId: itemsTable.categoryId,
        categoryName: categoriesTable.name,
      })
      .from(inventoryTable)
      .innerJoin(itemVariantsTable, eq(inventoryTable.variantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .leftJoin(unitsTable, eq(inventoryTable.unitId, unitsTable.id))
      .where(and(...conditions))
      .orderBy(itemsTable.name, itemVariantsTable.name);

    const result = rows.map((r) => ({
      ...r,
      isLowStock: r.lowStockThreshold !== null && parseFloat(r.quantity) <= parseFloat(r.lowStockThreshold),
    }));

    if (req.query["lowStock"] === "true") {
      res.json(result.filter((r) => r.isLowStock));
      return;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// All trackable ingredients with their current stock at a location (0 if never stocked).
// This is what the guided Stock page lists, so unstocked ingredients still show.
router.get("/inventory/levels", ...guard, async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const locationId = req.query["locationId"] as string | undefined;
    if (!locationId) { res.status(400).json({ error: "locationId is required" }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    // The unit shown is the inventory row's unit if stocked, else the
    // ingredient's own unit of measure (so it appears before any stock exists).
    const variantUnits = alias(unitsTable, "variant_units");
    const rows = await db
      .select({
        itemId: itemsTable.id,
        itemName: itemsTable.name,
        variantId: itemVariantsTable.id,
        variantName: itemVariantsTable.name,
        quantity: inventoryTable.quantity,
        lowStockThreshold: inventoryTable.lowStockThreshold,
        unitId: sql<string | null>`coalesce(${inventoryTable.unitId}, ${itemVariantsTable.unitId})`,
        unitAbbreviation: sql<string | null>`coalesce(${unitsTable.abbreviation}, ${variantUnits.abbreviation})`,
      })
      .from(itemVariantsTable)
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .leftJoin(inventoryTable, and(eq(inventoryTable.variantId, itemVariantsTable.id), eq(inventoryTable.locationId, locationId)))
      .leftJoin(unitsTable, eq(inventoryTable.unitId, unitsTable.id))
      .leftJoin(variantUnits, eq(itemVariantsTable.unitId, variantUnits.id))
      .where(and(tenantWhere(itemsTable.businessId, businessId), eq(itemsTable.type, "resource"), eq(itemsTable.active, true)))
      .orderBy(itemsTable.name);

    const result = rows.map((r) => ({
      ...r,
      quantity: r.quantity ?? "0",
      isLowStock: r.lowStockThreshold != null && r.quantity != null && parseFloat(r.quantity) <= parseFloat(r.lowStockThreshold),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Manual adjustment
const adjustSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  type: z.enum(["receive", "consume", "adjust", "transfer_in", "transfer_out", "waste", "return"]),
  quantityChange: z.string(),
  unitId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

router.post("/inventory/adjust", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, userId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = adjustSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    // The variant must belong to this business (prevents cross-tenant adjustment).
    const [ownsVariant] = await db.select({ id: itemVariantsTable.id }).from(itemVariantsTable)
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(and(eq(itemVariantsTable.id, body.data.variantId), tenantWhere(itemsTable.businessId, businessId)));
    if (!ownsVariant) { res.status(404).json({ error: "Item not found" }); return; }

    await db.transaction(async (tx) => {
      // Write transaction
      await tx.insert(inventoryTransactionsTable).values({
        ...body.data,
        createdBy: userId,
      });

      // Upsert inventory balance
      await tx
        .insert(inventoryTable)
        .values({
          variantId: body.data.variantId,
          locationId: body.data.locationId,
          quantity: body.data.quantityChange,
          unitId: body.data.unitId ?? null,
        })
        .onConflictDoUpdate({
          target: [inventoryTable.variantId, inventoryTable.locationId],
          set: {
            quantity: sql`${inventoryTable.quantity} + ${body.data.quantityChange}::numeric`,
          },
        });
    });

    res.status(201).json({ message: "Adjustment recorded" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Set low-stock alert threshold for a variant at a location
const thresholdSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  lowStockThreshold: z.string().nullable(),
});

router.patch("/inventory/threshold", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = thresholdSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const [ownsVariant] = await db.select({ id: itemVariantsTable.id }).from(itemVariantsTable)
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(and(eq(itemVariantsTable.id, body.data.variantId), tenantWhere(itemsTable.businessId, businessId)));
    if (!ownsVariant) { res.status(404).json({ error: "Item not found" }); return; }

    await db
      .insert(inventoryTable)
      .values({
        variantId: body.data.variantId,
        locationId: body.data.locationId,
        quantity: "0",
        lowStockThreshold: body.data.lowStockThreshold,
      })
      .onConflictDoUpdate({
        target: [inventoryTable.variantId, inventoryTable.locationId],
        set: { lowStockThreshold: body.data.lowStockThreshold },
      });

    res.json({ message: "Threshold updated" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Reorder suggestions: below-threshold ingredients at a location, with a
// suggested top-up quantity (toward 2× the threshold) and the last price paid.
// Feeds the "create order from low stock" button on Purchasing.
router.get("/inventory/reorder-suggestions", ...guard, async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const locationId = req.query["locationId"] as string | undefined;
    if (!locationId) { res.status(400).json({ error: "locationId is required" }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const rows = await db
      .select({
        variantId: itemVariantsTable.id,
        itemName: itemsTable.name,
        quantity: inventoryTable.quantity,
        threshold: inventoryTable.lowStockThreshold,
        unitId: inventoryTable.unitId,
        unitAbbreviation: unitsTable.abbreviation,
        lastUnitCost: sql<string | null>`(SELECT pol.unit_cost FROM purchase_order_lines pol JOIN purchase_orders po ON po.id = pol.purchase_order_id WHERE pol.variant_id = ${itemVariantsTable.id} AND po.business_id = ${businessId} ORDER BY pol.created_at DESC LIMIT 1)`,
        fallbackCost: sql<string | null>`coalesce(${itemVariantsTable.cost}, ${itemsTable.cost})`,
      })
      .from(inventoryTable)
      .innerJoin(itemVariantsTable, eq(inventoryTable.variantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .leftJoin(unitsTable, eq(inventoryTable.unitId, unitsTable.id))
      .where(and(
        tenantWhere(itemsTable.businessId, businessId),
        eq(inventoryTable.locationId, locationId),
        eq(itemsTable.active, true),
        isNotNull(inventoryTable.lowStockThreshold),
        sql`${inventoryTable.quantity} <= ${inventoryTable.lowStockThreshold}`,
      ))
      .orderBy(itemsTable.name);

    const suggestions = rows.map((r) => {
      const onHand = parseFloat(r.quantity);
      const threshold = parseFloat(r.threshold ?? "0");
      const topUp = threshold * 2 - onHand;
      const suggestedQty = (topUp > 0 ? topUp : threshold).toFixed(2);
      return {
        variantId: r.variantId,
        itemName: r.itemName,
        unitId: r.unitId,
        unitAbbreviation: r.unitAbbreviation,
        suggestedQty,
        unitCost: r.lastUnitCost ?? r.fallbackCost ?? "0",
      };
    });
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Inventory transactions log
router.get("/inventory/transactions", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const limit = Math.min(parseInt(req.query["limit"] as string || "50", 10), 200);
    const rows = await db
      .select({
        id: inventoryTransactionsTable.id,
        variantId: inventoryTransactionsTable.variantId,
        variantName: itemVariantsTable.name,
        itemName: itemsTable.name,
        locationId: inventoryTransactionsTable.locationId,
        type: inventoryTransactionsTable.type,
        quantityChange: inventoryTransactionsTable.quantityChange,
        referenceType: inventoryTransactionsTable.referenceType,
        referenceId: inventoryTransactionsTable.referenceId,
        notes: inventoryTransactionsTable.notes,
        createdBy: inventoryTransactionsTable.createdBy,
        createdAt: inventoryTransactionsTable.createdAt,
      })
      .from(inventoryTransactionsTable)
      .innerJoin(itemVariantsTable, eq(inventoryTransactionsTable.variantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(tenantWhere(itemsTable.businessId, businessId))
      .orderBy(desc(inventoryTransactionsTable.createdAt))
      .limit(limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
