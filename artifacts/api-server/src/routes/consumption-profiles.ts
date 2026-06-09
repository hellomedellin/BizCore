import { Router } from "express";
import { db } from "@bizcore/db";
import { consumptionProfilesTable, consumptionProfileLinesTable, itemsTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("consumption_profiles")];

router.get("/consumption-profiles", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db
      .select({
        id: consumptionProfilesTable.id,
        outputItemId: consumptionProfilesTable.outputItemId,
        outputVariantId: consumptionProfilesTable.outputVariantId,
        name: consumptionProfilesTable.name,
        notes: consumptionProfilesTable.notes,
        active: consumptionProfilesTable.active,
        itemName: itemsTable.name,
      })
      .from(consumptionProfilesTable)
      .leftJoin(itemsTable, eq(consumptionProfilesTable.outputItemId, itemsTable.id))
      .where(tenantWhere(consumptionProfilesTable.businessId, businessId))
      .orderBy(itemsTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createProfileSchema = z.object({
  outputItemId: z.string().uuid(),
  outputVariantId: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.post("/consumption-profiles", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = createProfileSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.insert(consumptionProfilesTable).values({ ...body.data, businessId }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/consumption-profiles/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [profile] = await db.select().from(consumptionProfilesTable).where(
      and(eq(consumptionProfilesTable.id, req.params["id"]!), tenantWhere(consumptionProfilesTable.businessId, businessId))
    );
    if (!profile) { res.status(404).json({ error: "Not found" }); return; }
    const lines = await db.select().from(consumptionProfileLinesTable).where(eq(consumptionProfileLinesTable.profileId, profile.id));
    res.json({ ...profile, lines });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Add/update lines
const resourceLineSchema = z.object({
  lineType: z.literal("resource"),
  resourceVariantId: z.string().uuid(),
  quantity: z.string(),
  unitId: z.string().uuid().nullable().optional(),
});

const laborLineSchema = z.object({
  lineType: z.literal("labor"),
  roleId: z.string().uuid().nullable().optional(),
  laborMinutes: z.string(),
});

const createLineSchema = z.discriminatedUnion("lineType", [resourceLineSchema, laborLineSchema]);

router.post("/consumption-profiles/:id/lines", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [profile] = await db.select({ id: consumptionProfilesTable.id }).from(consumptionProfilesTable).where(
      and(eq(consumptionProfilesTable.id, req.params["id"]!), tenantWhere(consumptionProfilesTable.businessId, businessId))
    );
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

    const body = createLineSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [row] = await db.insert(consumptionProfileLinesTable).values({ ...body.data, profileId: profile.id }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.delete("/consumption-profiles/:id/lines/:lineId", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [profile] = await db.select({ id: consumptionProfilesTable.id }).from(consumptionProfilesTable).where(
      and(eq(consumptionProfilesTable.id, req.params["id"]!), tenantWhere(consumptionProfilesTable.businessId, businessId))
    );
    if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }
    await db.delete(consumptionProfileLinesTable).where(
      and(eq(consumptionProfileLinesTable.id, req.params["lineId"]!), eq(consumptionProfileLinesTable.profileId, profile.id))
    );
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
