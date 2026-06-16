import { Router } from "express";
import { db } from "@bizcore/db";
import {
  inventoryTable, inventoryTransactionsTable, itemVariantsTable, itemsTable,
  categoriesTable, locationsTable, unitsTable,
} from "@bizcore/db/schema";
import { eq, and, ilike, sql, SQL, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("inventory")];

router.get("/inventory", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const locationId = req.query["locationId"] as string | undefined;
    if (!locationId) { res.status(400).json({ error: "locationId is required" }); return; }

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
      isLowStock: r.lowStockThreshold !== null && parseFloat(r.quantity) < parseFloat(r.lowStockThreshold),
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

// Manual adjustment
const adjustSchema = z.object({
  variantId: z.string().uuid(),
  locationId: z.string().uuid(),
  type: z.enum(["receive", "consume", "adjust", "transfer_in", "transfer_out", "waste", "return"]),
  quantityChange: z.string(),
  unitId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

router.post("/inventory/adjust", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const body = adjustSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

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
