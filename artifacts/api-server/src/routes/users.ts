import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable, businessUsersTable, businessesTable } from "@workspace/db";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const SyncUserBody = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  imageUrl: z.string().optional(),
});

const UpsertBusinessUserBody = z.object({
  userId: z.string().min(1),
  role: z.enum(["admin", "manager", "cashier", "hr"]),
  locationId: z.number().int().optional(),
});

// Sync Clerk user data to local users table (called on sign-in)
router.post(
  "/users/sync",
  requireAuth,
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    const parsed = SyncUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [user] = await db
      .insert(usersTable)
      .values({
        id: authedReq.userId,
        ...parsed.data,
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          email: parsed.data.email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          imageUrl: parsed.data.imageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(user);
  },
);

// List all users in the business (admin/manager)
router.get(
  "/business-users",
  requireAuth,
  loadBusiness,
  requireRole("admin", "manager"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.json([]);
      return;
    }

    const members = await db
      .select({
        id: businessUsersTable.id,
        userId: businessUsersTable.userId,
        role: businessUsersTable.role,
        locationId: businessUsersTable.locationId,
        active: businessUsersTable.active,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        imageUrl: usersTable.imageUrl,
      })
      .from(businessUsersTable)
      .leftJoin(usersTable, eq(businessUsersTable.userId, usersTable.id))
      .where(eq(businessUsersTable.businessId, authedReq.businessId));

    res.json(members);
  },
);

// Assign or update a user's role in the business (admin only)
router.post(
  "/business-users",
  requireAuth,
  loadBusiness,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.status(400).json({ error: "No business found" });
      return;
    }

    const parsed = UpsertBusinessUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // Don't allow assigning roles to the owner (they're always admin)
    const business = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.id, authedReq.businessId))
      .limit(1);

    if (business[0]?.ownerUserId === parsed.data.userId) {
      res.status(400).json({ error: "Cannot assign a role to the business owner" });
      return;
    }

    const existing = await db
      .select()
      .from(businessUsersTable)
      .where(eq(businessUsersTable.userId, parsed.data.userId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(businessUsersTable)
        .set({
          role: parsed.data.role,
          locationId: parsed.data.locationId ?? null,
          active: true,
        })
        .where(eq(businessUsersTable.id, existing[0].id))
        .returning();
      res.json(updated);
      return;
    }

    const [created] = await db
      .insert(businessUsersTable)
      .values({
        businessId: authedReq.businessId,
        userId: parsed.data.userId,
        role: parsed.data.role,
        locationId: parsed.data.locationId ?? null,
        active: true,
      })
      .returning();

    res.status(201).json(created);
  },
);

// Deactivate a business user (admin only)
router.delete(
  "/business-users/:id",
  requireAuth,
  loadBusiness,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.status(400).json({ error: "No business found" });
      return;
    }

    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId ?? "", 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [deactivated] = await db
      .update(businessUsersTable)
      .set({ active: false })
      .where(eq(businessUsersTable.id, id))
      .returning();

    if (!deactivated) {
      res.status(404).json({ error: "Business user not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
