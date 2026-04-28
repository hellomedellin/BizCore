import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  businessesTable,
  businessModulesTable,
  businessUsersTable,
} from "@workspace/db";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import {
  CreateBusinessBody,
  UpdateBusinessBody,
  UpdateBusinessParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const ALL_MODULES = [
  "inventory",
  "orders",
  "employees",
  "scheduling",
  "time_tracking",
  "reports",
  "payroll_future",
  "recipes_future",
];

router.get(
  "/businesses/me",
  requireAuth,
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    const userId = authedReq.userId;

    // Check if user owns a business
    const ownedBusiness = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.ownerUserId, userId))
      .limit(1);

    if (ownedBusiness.length > 0) {
      res.json(ownedBusiness[0]);
      return;
    }

    // Check if user is a member of any business via business_users
    const membership = await db
      .select({ businessId: businessUsersTable.businessId })
      .from(businessUsersTable)
      .where(
        and(
          eq(businessUsersTable.userId, userId),
          eq(businessUsersTable.active, true),
        ),
      )
      .limit(1);

    if (membership.length > 0) {
      const memberBusiness = await db
        .select()
        .from(businessesTable)
        .where(eq(businessesTable.id, membership[0].businessId))
        .limit(1);

      if (memberBusiness.length > 0) {
        res.json(memberBusiness[0]);
        return;
      }
    }

    res.status(404).json({ error: "No business found" });
  },
);

router.post(
  "/businesses",
  requireAuth,
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    const userId = authedReq.userId;

    const existing = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.ownerUserId, userId))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: "User already has a business" });
      return;
    }

    const parsed = CreateBusinessBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [business] = await db
      .insert(businessesTable)
      .values({ ...parsed.data, ownerUserId: userId })
      .returning();

    await db.insert(businessModulesTable).values(
      ALL_MODULES.map((module) => ({
        businessId: business.id,
        module,
        enabled: ["inventory", "orders", "employees"].includes(module),
      })),
    );

    res.status(201).json(business);
  },
);

// Only admin/owner can update business settings
router.patch(
  "/businesses/:id",
  requireAuth,
  loadBusiness,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    const params = UpdateBusinessParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateBusinessBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [business] = await db
      .update(businessesTable)
      .set(parsed.data)
      .where(
        and(
          eq(businessesTable.id, params.data.id),
          eq(businessesTable.ownerUserId, authedReq.userId),
        ),
      )
      .returning();

    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    res.json(business);
  },
);

export default router;
