import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db/schema";
import { eq, and, ilike, or, SQL } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

const CreateCustomerBodySchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const UpdateCustomerBodySchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get("/customers", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const { search } = req.query;
    const conditions: SQL[] = [tenantWhere(customersTable.businessId, businessId!)];

    if (search && typeof search === "string" && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(customersTable.name, q),
          ilike(customersTable.phone, q),
          ilike(customersTable.email, q)
        )!
      );
    }

    const rows = await db
      .select()
      .from(customersTable)
      .where(and(...conditions))
      .orderBy(customersTable.name)
      .limit(100);

    res.json(rows);
  } catch (err: unknown) {
    console.error("GET /customers error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [row] = await db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.id, id), tenantWhere(customersTable.businessId, businessId!)));

    if (!row) { res.status(404).json({ error: "Customer not found" }); return; }
    res.json(row);
  } catch (err: unknown) {
    console.error("GET /customers/:id error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers", requireAuth, loadBusiness, requireRole("admin", "manager", "cashier"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const body = CreateCustomerBodySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [created] = await db
      .insert(customersTable)
      .values({ ...body.data, businessId: businessId! })
      .returning();

    res.status(201).json(created);
  } catch (err: unknown) {
    console.error("POST /customers error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/customers/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = UpdateCustomerBodySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(and(eq(customersTable.id, id), tenantWhere(customersTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Customer not found" }); return; }

    const [updated] = await db
      .update(customersTable)
      .set(body.data)
      .where(eq(customersTable.id, id))
      .returning();

    res.json(updated);
  } catch (err: unknown) {
    console.error("PATCH /customers/:id error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/customers/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [existing] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(and(eq(customersTable.id, id), tenantWhere(customersTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Customer not found" }); return; }

    await db.delete(customersTable).where(eq(customersTable.id, id));
    res.status(204).end();
  } catch (err: unknown) {
    console.error("DELETE /customers/:id error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
