import { Router } from "express";
import { db } from "@bizcore/db";
import { itemsTable, itemVariantsTable, categoriesTable, consumptionProfilesTable, consumptionProfileLinesTable } from "@bizcore/db/schema";
import { eq, and, ilike, inArray, sql, SQL } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("inventory")];

// ─── Items ────────────────────────────────────────────────────────────────────

router.get("/items", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions: SQL[] = [tenantWhere(itemsTable.businessId, businessId)];
    if (req.query["type"]) conditions.push(eq(itemsTable.type, req.query["type"] as any));
    if (req.query["categoryId"]) conditions.push(eq(itemsTable.categoryId, req.query["categoryId"] as string));
    if (req.query["active"] !== undefined) conditions.push(eq(itemsTable.active, req.query["active"] === "true"));
    if (req.query["search"]) conditions.push(ilike(itemsTable.name, `%${req.query["search"]}%`));

    const rows = await db
      .select({
        id: itemsTable.id,
        businessId: itemsTable.businessId,
        name: itemsTable.name,
        description: itemsTable.description,
        type: itemsTable.type,
        categoryId: itemsTable.categoryId,
        categoryName: categoriesTable.name,
        basePrice: itemsTable.basePrice,
        cost: itemsTable.cost,
        trackInventory: itemsTable.trackInventory,
        hasVariants: itemsTable.hasVariants,
        imageUrl: itemsTable.imageUrl,
        active: itemsTable.active,
        // Available unless it has an active variant that's been marked sold out (86'd).
        isAvailable: sql<boolean>`NOT EXISTS (SELECT 1 FROM item_variants iv WHERE iv.item_id = ${itemsTable.id} AND iv.active = true AND iv.is_available = false)`,
        createdAt: itemsTable.createdAt,
        updatedAt: itemsTable.updatedAt,
      })
      .from(itemsTable)
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(and(...conditions))
      .orderBy(itemsTable.name);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Sellable menu items, one row per priced variant — used by the order builder.
// Declared before /items/:id so "menu" isn't captured as an :id.
router.get("/items/menu", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db
      .select({
        itemId: itemsTable.id,
        itemName: itemsTable.name,
        categoryName: categoriesTable.name,
        variantId: itemVariantsTable.id,
        variantName: itemVariantsTable.name,
        price: itemVariantsTable.price,
        isAvailable: itemVariantsTable.isAvailable,
      })
      .from(itemVariantsTable)
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(and(
        tenantWhere(itemsTable.businessId, businessId),
        inArray(itemsTable.type, ["product", "service", "bundle"]),
        eq(itemsTable.active, true),
        eq(itemVariantsTable.active, true),
      ))
      .orderBy(itemsTable.name, itemVariantsTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Ingredients (resource items), one row per variant — used by the recipe editor.
router.get("/items/ingredients", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db
      .select({
        itemId: itemsTable.id,
        itemName: itemsTable.name,
        variantId: itemVariantsTable.id,
        variantName: itemVariantsTable.name,
        cost: sql<string | null>`coalesce(${itemVariantsTable.cost}, ${itemsTable.cost})`,
      })
      .from(itemVariantsTable)
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(and(tenantWhere(itemsTable.businessId, businessId), eq(itemsTable.type, "resource"), eq(itemsTable.active, true), eq(itemVariantsTable.active, true)))
      .orderBy(itemsTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Plate cost + margin per menu item, computed from recipes (consumption profiles).
// plateCost = Σ (recipe line quantity × ingredient unit cost). Null when no recipe.
// Note: assumes recipe quantity and ingredient cost share a unit (no unit conversion yet).
router.get("/menu/costing", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const menuItems = await db
      .select({ id: itemsTable.id, basePrice: itemsTable.basePrice })
      .from(itemsTable)
      .where(and(
        tenantWhere(itemsTable.businessId, businessId),
        inArray(itemsTable.type, ["product", "service", "bundle"]),
        eq(itemsTable.active, true),
      ));

    const lines = await db
      .select({
        outputItemId: consumptionProfilesTable.outputItemId,
        quantity: consumptionProfileLinesTable.quantity,
        variantCost: itemVariantsTable.cost,
        itemCost: itemsTable.cost,
      })
      .from(consumptionProfilesTable)
      .innerJoin(consumptionProfileLinesTable, eq(consumptionProfileLinesTable.profileId, consumptionProfilesTable.id))
      .leftJoin(itemVariantsTable, eq(consumptionProfileLinesTable.resourceVariantId, itemVariantsTable.id))
      .leftJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(and(
        tenantWhere(consumptionProfilesTable.businessId, businessId),
        eq(consumptionProfilesTable.active, true),
        eq(consumptionProfileLinesTable.lineType, "resource"),
      ));

    const costByItem = new Map<string, number>();
    for (const l of lines) {
      if (!l.quantity) continue;
      const unit = parseFloat(l.variantCost ?? l.itemCost ?? "0");
      const qty = parseFloat(l.quantity);
      if (!Number.isFinite(unit) || !Number.isFinite(qty)) continue;
      costByItem.set(l.outputItemId, (costByItem.get(l.outputItemId) ?? 0) + unit * qty);
    }

    const result = menuItems.map((it) => {
      const plateCost = costByItem.has(it.id) ? costByItem.get(it.id)! : null;
      const price = it.basePrice ? parseFloat(it.basePrice) : null;
      const marginPct = plateCost != null && price != null && price > 0
        ? Math.round(((price - plateCost) / price) * 100)
        : null;
      return {
        itemId: it.id,
        plateCost: plateCost != null ? plateCost.toFixed(2) : null,
        price: it.basePrice ?? null,
        marginPct,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum(["product", "resource", "service", "bundle"]).default("product"),
  categoryId: z.string().uuid().nullable().optional(),
  basePrice: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  trackInventory: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
});

router.post("/items", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = createItemSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [item] = await db.insert(itemsTable).values({ ...body.data, businessId }).returning();

    // Auto-create a Default variant for items without real variants
    if (!body.data.hasVariants) {
      await db.insert(itemVariantsTable).values({
        itemId: item!.id,
        name: "Default",
        price: body.data.basePrice ?? null,
        cost: body.data.cost ?? null,
      });
    }

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/items/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [item] = await db
      .select({
        id: itemsTable.id,
        businessId: itemsTable.businessId,
        name: itemsTable.name,
        description: itemsTable.description,
        type: itemsTable.type,
        categoryId: itemsTable.categoryId,
        categoryName: categoriesTable.name,
        basePrice: itemsTable.basePrice,
        cost: itemsTable.cost,
        trackInventory: itemsTable.trackInventory,
        hasVariants: itemsTable.hasVariants,
        imageUrl: itemsTable.imageUrl,
        active: itemsTable.active,
        createdAt: itemsTable.createdAt,
        updatedAt: itemsTable.updatedAt,
      })
      .from(itemsTable)
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(and(eq(itemsTable.id, req.params["id"] as string), tenantWhere(itemsTable.businessId, businessId)));

    if (!item) { res.status(404).json({ error: "Not found" }); return; }

    const variants = await db.select().from(itemVariantsTable).where(eq(itemVariantsTable.itemId, item.id));
    res.json({ ...item, variants });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const updateItemSchema = createItemSchema.partial().extend({ active: z.boolean().optional() });

router.patch("/items/:id", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = updateItemSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.update(itemsTable).set(body.data).where(
      and(eq(itemsTable.id, req.params["id"] as string), tenantWhere(itemsTable.businessId, businessId))
    ).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    // Keep the auto-created single "Default" variant's price in sync so the
    // sellable price always matches the edited menu price for simple items.
    if (body.data.basePrice !== undefined) {
      const variants = await db.select({ id: itemVariantsTable.id }).from(itemVariantsTable).where(eq(itemVariantsTable.itemId, row.id));
      if (variants.length === 1) {
        await db.update(itemVariantsTable).set({ price: body.data.basePrice }).where(eq(itemVariantsTable.id, variants[0]!.id));
      }
    }

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── Variants ─────────────────────────────────────────────────────────────────

const createVariantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  attributes: z.record(z.string()).nullable().optional(),
  isAvailable: z.boolean().optional(),
});

// Toggle a menu item's availability (the "86" button). Flips every active
// variant so a one-tap switch on the menu row works for simple items.
router.patch("/items/:id/availability", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.object({ isAvailable: z.boolean() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [item] = await db.select({ id: itemsTable.id }).from(itemsTable).where(
      and(eq(itemsTable.id, req.params["id"] as string), tenantWhere(itemsTable.businessId, businessId))
    );
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    await db.update(itemVariantsTable).set({ isAvailable: body.data.isAvailable }).where(eq(itemVariantsTable.itemId, item.id));
    res.json({ id: item.id, isAvailable: body.data.isAvailable });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.post("/items/:id/variants", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [item] = await db.select({ id: itemsTable.id }).from(itemsTable).where(
      and(eq(itemsTable.id, req.params["id"] as string), tenantWhere(itemsTable.businessId, businessId))
    );
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const body = createVariantSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [variant] = await db.insert(itemVariantsTable).values({ ...body.data, itemId: item.id }).returning();
    res.status(201).json(variant);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.patch("/items/:id/variants/:variantId", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [item] = await db.select({ id: itemsTable.id }).from(itemsTable).where(
      and(eq(itemsTable.id, req.params["id"] as string), tenantWhere(itemsTable.businessId, businessId))
    );
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const body = createVariantSchema.partial().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [variant] = await db.update(itemVariantsTable).set(body.data).where(
      and(eq(itemVariantsTable.id, req.params["variantId"] as string), eq(itemVariantsTable.itemId, item.id))
    ).returning();
    if (!variant) { res.status(404).json({ error: "Variant not found" }); return; }
    res.json(variant);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
