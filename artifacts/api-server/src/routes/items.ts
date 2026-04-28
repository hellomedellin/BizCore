import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { itemsTable, itemVariantsTable, categoriesTable } from "@workspace/db/schema";
import { eq, and, ilike, SQL } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

router.get("/items", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const { search, type, categoryId, active } = req.query;

    const conditions: SQL[] = [tenantWhere(itemsTable.businessId, businessId!)];
    if (type && typeof type === "string") conditions.push(eq(itemsTable.type, type));
    if (categoryId && !isNaN(parseInt(categoryId as string))) {
      conditions.push(eq(itemsTable.categoryId, parseInt(categoryId as string)));
    }
    if (active !== undefined) {
      conditions.push(eq(itemsTable.active, active === "true"));
    }
    if (search && typeof search === "string" && search.trim()) {
      conditions.push(ilike(itemsTable.name, `%${search.trim()}%`));
    }

    const rows = await db
      .select({
        id: itemsTable.id,
        businessId: itemsTable.businessId,
        name: itemsTable.name,
        description: itemsTable.description,
        type: itemsTable.type,
        categoryId: itemsTable.categoryId,
        basePrice: itemsTable.basePrice,
        cost: itemsTable.cost,
        trackInventory: itemsTable.trackInventory,
        hasVariants: itemsTable.hasVariants,
        imageUrl: itemsTable.imageUrl,
        active: itemsTable.active,
        createdAt: itemsTable.createdAt,
        updatedAt: itemsTable.updatedAt,
        categoryName: categoriesTable.name,
      })
      .from(itemsTable)
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(and(...conditions))
      .orderBy(itemsTable.name);

    res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.enum(["product", "service", "ingredient", "menu_item"]),
  categoryId: z.number().int().nullable().optional(),
  basePrice: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  trackInventory: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
});

router.post("/items", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const body = createItemSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [row] = await db
      .insert(itemsTable)
      .values({ businessId: businessId!, ...body.data })
      .returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

router.get("/items/:id", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const rows = await db
      .select({
        id: itemsTable.id,
        businessId: itemsTable.businessId,
        name: itemsTable.name,
        description: itemsTable.description,
        type: itemsTable.type,
        categoryId: itemsTable.categoryId,
        basePrice: itemsTable.basePrice,
        cost: itemsTable.cost,
        trackInventory: itemsTable.trackInventory,
        hasVariants: itemsTable.hasVariants,
        imageUrl: itemsTable.imageUrl,
        active: itemsTable.active,
        createdAt: itemsTable.createdAt,
        updatedAt: itemsTable.updatedAt,
        categoryName: categoriesTable.name,
      })
      .from(itemsTable)
      .leftJoin(categoriesTable, eq(itemsTable.categoryId, categoriesTable.id))
      .where(and(eq(itemsTable.id, id), tenantWhere(itemsTable.businessId, businessId!)));

    if (!rows[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const variants = await db
      .select()
      .from(itemVariantsTable)
      .where(eq(itemVariantsTable.itemId, id))
      .orderBy(itemVariantsTable.name);

    res.json({ ...rows[0], variants });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(["product", "service", "ingredient", "menu_item"]).optional(),
  categoryId: z.number().int().nullable().optional(),
  basePrice: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  trackInventory: z.boolean().optional(),
  hasVariants: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

router.patch("/items/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = updateItemSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [row] = await db
      .update(itemsTable)
      .set(body.data)
      .where(and(eq(itemsTable.id, id), tenantWhere(itemsTable.businessId, businessId!)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

router.delete("/items/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db
      .delete(itemsTable)
      .where(and(eq(itemsTable.id, id), tenantWhere(itemsTable.businessId, businessId!)));
    res.status(204).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

const createVariantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  attributes: z.record(z.unknown()).nullable().optional(),
});

router.get("/items/:itemId/variants", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const itemId = parseInt(req.params.itemId as string);
    if (isNaN(itemId)) {
      res.status(400).json({ error: "Invalid itemId" });
      return;
    }

    const [item] = await db
      .select({ id: itemsTable.id })
      .from(itemsTable)
      .where(and(eq(itemsTable.id, itemId), tenantWhere(itemsTable.businessId, businessId!)));
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const variants = await db
      .select()
      .from(itemVariantsTable)
      .where(eq(itemVariantsTable.itemId, itemId))
      .orderBy(itemVariantsTable.name);
    res.json(variants);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

router.post("/items/:itemId/variants", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const itemId = parseInt(req.params.itemId as string);
    if (isNaN(itemId)) {
      res.status(400).json({ error: "Invalid itemId" });
      return;
    }

    const [item] = await db
      .select({ id: itemsTable.id })
      .from(itemsTable)
      .where(and(eq(itemsTable.id, itemId), tenantWhere(itemsTable.businessId, businessId!)));
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const body = createVariantSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [row] = await db
      .insert(itemVariantsTable)
      .values({ itemId, ...body.data })
      .returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

const updateVariantSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  cost: z.string().nullable().optional(),
  attributes: z.record(z.unknown()).nullable().optional(),
  active: z.boolean().optional(),
});

router.patch("/variants/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = updateVariantSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [variant] = await db
      .select({ id: itemVariantsTable.id, itemId: itemVariantsTable.itemId })
      .from(itemVariantsTable)
      .where(eq(itemVariantsTable.id, id));
    if (!variant) {
      res.status(404).json({ error: "Variant not found" });
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

    const [row] = await db
      .update(itemVariantsTable)
      .set(body.data)
      .where(eq(itemVariantsTable.id, id))
      .returning();
    res.json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

router.delete("/variants/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const [variant] = await db
      .select({ id: itemVariantsTable.id, itemId: itemVariantsTable.itemId })
      .from(itemVariantsTable)
      .where(eq(itemVariantsTable.id, id));
    if (!variant) {
      res.status(404).json({ error: "Variant not found" });
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

    await db.delete(itemVariantsTable).where(eq(itemVariantsTable.id, id));
    res.status(204).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

export default router;
