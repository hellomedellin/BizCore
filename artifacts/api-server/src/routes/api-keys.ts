import { Router } from "express";
import { db } from "@bizcore/db";
import { apiKeysTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireRole("owner", "admin")];

router.get("/api-keys", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db.select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      locationId: apiKeysTable.locationId,
      scopes: apiKeysTable.scopes,
      active: apiKeysTable.active,
      lastUsedAt: apiKeysTable.lastUsedAt,
      createdAt: apiKeysTable.createdAt,
    }).from(apiKeysTable).where(tenantWhere(apiKeysTable.businessId, businessId)).orderBy(apiKeysTable.createdAt);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createKeySchema = z.object({
  name: z.string().min(1),
  locationId: z.string().uuid().nullable().optional(),
  scopes: z.array(z.string()).default([]),
});

router.post("/api-keys", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = createKeySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const raw = `bzk_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(raw).digest("hex");
    const keyPrefix = raw.slice(0, 8);

    const [row] = await db.insert(apiKeysTable).values({
      businessId,
      name: body.data.name,
      keyHash,
      keyPrefix,
      locationId: body.data.locationId ?? null,
      scopes: body.data.scopes,
    }).returning({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      locationId: apiKeysTable.locationId,
      scopes: apiKeysTable.scopes,
      active: apiKeysTable.active,
      createdAt: apiKeysTable.createdAt,
    });

    // Return the raw key ONCE — it is never stored and cannot be retrieved again
    res.status(201).json({ ...row, key: raw });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.patch("/api-keys/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.object({ name: z.string().optional(), active: z.boolean().optional(), scopes: z.array(z.string()).optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.update(apiKeysTable).set(body.data)
      .where(and(eq(apiKeysTable.id, req.params["id"]!), tenantWhere(apiKeysTable.businessId, businessId)))
      .returning({ id: apiKeysTable.id, name: apiKeysTable.name, keyPrefix: apiKeysTable.keyPrefix, active: apiKeysTable.active, scopes: apiKeysTable.scopes });
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.delete("/api-keys/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [row] = await db.delete(apiKeysTable)
      .where(and(eq(apiKeysTable.id, req.params["id"]!), tenantWhere(apiKeysTable.businessId, businessId)))
      .returning({ id: apiKeysTable.id });
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
