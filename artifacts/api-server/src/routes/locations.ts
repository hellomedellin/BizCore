import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { locationsTable } from "@workspace/db";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import {
  CreateLocationBody,
  UpdateLocationBody,
  UpdateLocationParams,
  DeleteLocationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// All authenticated users can list locations
router.get(
  "/locations",
  requireAuth,
  loadBusiness,
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.json([]);
      return;
    }

    const locations = await db
      .select()
      .from(locationsTable)
      .where(eq(locationsTable.businessId, authedReq.businessId));

    res.json(locations);
  },
);

// Only admin or manager can create locations
router.post(
  "/locations",
  requireAuth,
  loadBusiness,
  requireRole("admin", "manager"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.status(400).json({ error: "No business found" });
      return;
    }

    const parsed = CreateLocationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [location] = await db
      .insert(locationsTable)
      .values({ ...parsed.data, businessId: authedReq.businessId })
      .returning();

    res.status(201).json(location);
  },
);

// Only admin or manager can update locations
router.patch(
  "/locations/:id",
  requireAuth,
  loadBusiness,
  requireRole("admin", "manager"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.status(400).json({ error: "No business found" });
      return;
    }

    const params = UpdateLocationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateLocationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [location] = await db
      .update(locationsTable)
      .set(parsed.data)
      .where(
        and(
          eq(locationsTable.id, params.data.id),
          eq(locationsTable.businessId, authedReq.businessId),
        ),
      )
      .returning();

    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    res.json(location);
  },
);

// Only admin can delete locations
router.delete(
  "/locations/:id",
  requireAuth,
  loadBusiness,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    if (!authedReq.businessId) {
      res.status(400).json({ error: "No business found" });
      return;
    }

    const params = DeleteLocationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [location] = await db
      .delete(locationsTable)
      .where(
        and(
          eq(locationsTable.id, params.data.id),
          eq(locationsTable.businessId, authedReq.businessId),
        ),
      )
      .returning();

    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
