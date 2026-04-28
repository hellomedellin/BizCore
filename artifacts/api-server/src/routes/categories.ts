import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

router.get("/categories", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const rows = await db
      .select()
      .from(categoriesTable)
      .where(tenantWhere(categoriesTable.businessId, businessId!))
      .orderBy(categoriesTable.sortOrder, categoriesTable.name);
    res.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

router.post("/categories", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const body = createCategorySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [row] = await db
      .insert(categoriesTable)
      .values({ businessId: businessId!, ...body.data })
      .returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  parentId: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

router.patch("/categories/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = updateCategorySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [row] = await db
      .update(categoriesTable)
      .set(body.data)
      .where(and(eq(categoriesTable.id, id), tenantWhere(categoriesTable.businessId, businessId!)))
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

router.delete("/categories/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
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
      .delete(categoriesTable)
      .where(and(eq(categoriesTable.id, id), tenantWhere(categoriesTable.businessId, businessId!)));
    res.status(204).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

export default router;
