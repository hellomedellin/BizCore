import { Router } from "express";
import { db } from "@bizcore/db";
import { suppliersTable } from "@bizcore/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireModule, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("purchasing")];

router.get("/suppliers", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions = [tenantWhere(suppliersTable.businessId, businessId)];
    if (req.query["search"]) conditions.push(ilike(suppliersTable.name, `%${req.query["search"]}%`));
    // Default to active-only; pass ?active=false to include removed suppliers.
    conditions.push(eq(suppliersTable.active, req.query["active"] === undefined ? true : req.query["active"] === "true"));
    const rows = await db.select().from(suppliersTable).where(and(...conditions)).orderBy(suppliersTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

router.post("/suppliers", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = supplierSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.insert(suppliersTable).values({ ...body.data, businessId }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/suppliers/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [row] = await db.select().from(suppliersTable).where(and(eq(suppliersTable.id, req.params["id"]!), tenantWhere(suppliersTable.businessId, businessId)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.patch("/suppliers/:id", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = supplierSchema.partial().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.update(suppliersTable).set(body.data).where(and(eq(suppliersTable.id, req.params["id"]!), tenantWhere(suppliersTable.businessId, businessId))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
