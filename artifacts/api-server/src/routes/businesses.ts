import { Router } from "express";
import { db } from "@bizcore/db";
import { businessesTable, locationsTable, businessModulesTable, businessUsersTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();

// ─── GET /businesses/me ───────────────────────────────────────────────────────

router.get("/businesses/me", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [business] = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.id, businessId));

    if (!business) { res.status(404).json({ error: "Business not found" }); return; }
    res.json(business);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── POST /businesses ─────────────────────────────────────────────────────────

const createBusinessSchema = z.object({
  name: z.string().min(1),
  currencyCode: z.string().length(3).default("USD"),
  timezone: z.string().default("America/New_York"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

router.post("/businesses", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  try {
    const body = createBusinessSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [business] = await db
      .insert(businessesTable)
      .values({ ...body.data, ownerUserId: userId })
      .returning();

    // Create owner business_user record
    await db.insert(businessUsersTable).values({
      businessId: business!.id,
      userId,
      role: "owner",
    });

    res.status(201).json(business);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── PATCH /businesses/me ─────────────────────────────────────────────────────

const updateBusinessSchema = z.object({
  name: z.string().min(1).optional(),
  currencyCode: z.string().length(3).optional(),
  timezone: z.string().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
});

router.patch("/businesses/me", requireAuth, loadBusiness, requireRole("admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = updateBusinessSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [updated] = await db
      .update(businessesTable)
      .set(body.data)
      .where(eq(businessesTable.id, businessId))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
