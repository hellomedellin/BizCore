import { Router } from "express";
import { db } from "@bizcore/db";
import { locationsTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();

router.get("/locations", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db.select().from(locationsTable).where(tenantWhere(locationsTable.businessId, businessId));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createLocationSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["restaurant", "retail", "service", "warehouse", "office"]).default("service"),
  address: z.string().optional(),
  phone: z.string().optional(),
  timezone: z.string().default("America/New_York"),
});

router.post("/locations", requireAuth, loadBusiness, requireRole("admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = createLocationSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.insert(locationsTable).values({ ...body.data, businessId }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/locations/:id", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [row] = await db.select().from(locationsTable).where(
      and(eq(locationsTable.id, req.params["id"] as string), tenantWhere(locationsTable.businessId, businessId))
    );
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["restaurant", "retail", "service", "warehouse", "office"]).optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
});

router.patch("/locations/:id", requireAuth, loadBusiness, requireRole("admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = updateLocationSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.update(locationsTable)
      .set(body.data)
      .where(and(eq(locationsTable.id, req.params["id"] as string), tenantWhere(locationsTable.businessId, businessId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
