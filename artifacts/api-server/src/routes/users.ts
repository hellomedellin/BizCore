import { Router } from "express";
import { db } from "@bizcore/db";
import { usersTable, businessUsersTable, businessUserLocationsTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();

// Get current user profile
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// List team members for a business
router.get("/team", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db
      .select({
        id: businessUsersTable.id,
        userId: businessUsersTable.userId,
        role: businessUsersTable.role,
        active: businessUsersTable.active,
        email: usersTable.email,
        name: usersTable.name,
      })
      .from(businessUsersTable)
      .leftJoin(usersTable, eq(businessUsersTable.userId, usersTable.id))
      .where(tenantWhere(businessUsersTable.businessId, businessId));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Update team member role
const updateRoleSchema = z.object({
  role: z.enum(["admin", "manager", "staff", "viewer"]),
});

router.patch("/team/:businessUserId", requireAuth, loadBusiness, requireRole("owner", "admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = updateRoleSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [row] = await db
      .update(businessUsersTable)
      .set(body.data)
      .where(and(
        eq(businessUsersTable.id, req.params["businessUserId"]!),
        tenantWhere(businessUsersTable.businessId, businessId),
      ))
      .returning();

    if (!row) { res.status(404).json({ error: "Team member not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Set location access for a team member
router.put("/team/:businessUserId/locations", requireAuth, loadBusiness, requireRole("owner", "admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.object({ locationIds: z.array(z.string().uuid()) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [bu] = await db
      .select({ id: businessUsersTable.id })
      .from(businessUsersTable)
      .where(and(
        eq(businessUsersTable.id, req.params["businessUserId"]!),
        tenantWhere(businessUsersTable.businessId, businessId),
      ));
    if (!bu) { res.status(404).json({ error: "Team member not found" }); return; }

    // Replace all location access rows
    await db.delete(businessUserLocationsTable).where(eq(businessUserLocationsTable.businessUserId, bu.id));

    if (body.data.locationIds.length > 0) {
      await db.insert(businessUserLocationsTable).values(
        body.data.locationIds.map((locationId) => ({ businessUserId: bu.id, locationId }))
      );
    }

    res.json({ message: "Location access updated" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
