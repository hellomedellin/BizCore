import { Router } from "express";
import { db } from "@bizcore/db";
import { businessModulesTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();

router.get("/modules", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db.select().from(businessModulesTable).where(tenantWhere(businessModulesTable.businessId, businessId));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const upsertModuleSchema = z.object({
  module: z.enum([
    "inventory", "consumption_profiles", "orders", "customers", "employees",
    "time_tracking", "scheduling", "purchasing", "invoice_ai", "reporting", "api_access",
  ]),
  enabled: z.boolean(),
  configuration: z.record(z.unknown()).optional(),
});

router.put("/modules", requireAuth, loadBusiness, requireRole("owner", "admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = upsertModuleSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [row] = await db
      .insert(businessModulesTable)
      .values({ businessId, ...body.data })
      .onConflictDoUpdate({
        target: [businessModulesTable.businessId, businessModulesTable.module],
        set: { enabled: body.data.enabled, configuration: body.data.configuration ?? null },
      })
      .returning();

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Bulk upsert — used during onboarding
router.put("/modules/bulk", requireAuth, loadBusiness, requireRole("owner", "admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.array(upsertModuleSchema).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const rows = await db
      .insert(businessModulesTable)
      .values(body.data.map((m) => ({ businessId, ...m })))
      .onConflictDoUpdate({
        target: [businessModulesTable.businessId, businessModulesTable.module],
        set: { enabled: businessModulesTable.enabled },
      })
      .returning();

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
