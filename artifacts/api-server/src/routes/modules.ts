import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { businessModulesTable } from "@workspace/db";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { UpdateModulesBody } from "@workspace/api-zod";

const router: IRouter = Router();

// All authenticated users can view modules
router.get(
  "/modules",
  requireAuth,
  loadBusiness,
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.json([]);
      return;
    }

    const modules = await db
      .select()
      .from(businessModulesTable)
      .where(eq(businessModulesTable.businessId, authedReq.businessId));

    res.json(modules);
  },
);

// Only admin can toggle module configuration
router.put(
  "/modules",
  requireAuth,
  loadBusiness,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.status(400).json({ error: "No business found" });
      return;
    }

    const parsed = UpdateModulesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const businessId = authedReq.businessId;

    const updates = await Promise.all(
      parsed.data.modules.map(async ({ module, enabled }) => {
        const existing = await db
          .select()
          .from(businessModulesTable)
          .where(
            and(
              eq(businessModulesTable.businessId, businessId),
              eq(businessModulesTable.module, module),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          const [created] = await db
            .insert(businessModulesTable)
            .values({ businessId, module, enabled })
            .returning();
          return created;
        }

        const [updated] = await db
          .update(businessModulesTable)
          .set({ enabled })
          .where(eq(businessModulesTable.id, existing[0].id))
          .returning();
        return updated;
      }),
    );

    res.json(updates);
  },
);

export default router;
