import { Router } from "express";
import { db } from "@bizcore/db";
import { unitsTable } from "@bizcore/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";

const router = Router();

// All authenticated users can read units
router.get("/units", requireAuth, loadBusiness, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(unitsTable).orderBy(unitsTable.unitType, unitsTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Only admins can add custom units
const createUnitSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  unitType: z.enum(["mass", "volume", "length", "count", "time"]),
  conversionToBase: z.string(),
});

router.post("/units", requireAuth, loadBusiness, requireRole("owner", "admin"), async (req, res): Promise<void> => {
  try {
    const body = createUnitSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.insert(unitsTable).values({ ...body.data, isSystem: false }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// System units cannot be deleted
router.delete("/units/:id", requireAuth, loadBusiness, requireRole("owner", "admin"), async (req, res): Promise<void> => {
  try {
    const [unit] = await db.select().from(unitsTable).where(eq(unitsTable.id, req.params["id"] as string));
    if (!unit) { res.status(404).json({ error: "Not found" }); return; }
    if (unit.isSystem) { res.status(400).json({ error: "System units cannot be deleted" }); return; }
    await db.delete(unitsTable).where(eq(unitsTable.id, req.params["id"] as string));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
