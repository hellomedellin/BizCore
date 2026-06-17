import { Router } from "express";
import { db } from "@bizcore/db";
import { categoriesTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("inventory")];

router.get("/categories", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db.select().from(categoriesTable)
      .where(tenantWhere(categoriesTable.businessId, businessId))
      .orderBy(categoriesTable.sortOrder, categoriesTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional().transform((v) => (v == null ? undefined : String(v))),
});

router.post("/categories", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = createCategorySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.insert(categoriesTable).values({ ...body.data, businessId }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.patch("/categories/:id", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = createCategorySchema.partial().extend({ active: z.boolean().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.update(categoriesTable).set(body.data)
      .where(and(eq(categoriesTable.id, req.params["id"] as string), tenantWhere(categoriesTable.businessId, businessId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
