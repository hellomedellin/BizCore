import { Router } from "express";
import { db } from "@bizcore/db";
import { appUsersTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireRole("admin")]; // owner passes via requireRole bypass

const SAFE_COLS = {
  id: appUsersTable.id,
  username: appUsersTable.username,
  displayName: appUsersTable.displayName,
  role: appUsersTable.role,
  employeeId: appUsersTable.employeeId,
  active: appUsersTable.active,
  createdAt: appUsersTable.createdAt,
};

// GET /app-users
router.get("/app-users", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const users = await db.select(SAFE_COLS).from(appUsersTable)
      .where(tenantWhere(appUsersTable.businessId, businessId))
      .orderBy(appUsersTable.createdAt);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// POST /app-users — owner can create any role; admin cannot create owner
router.post("/app-users", ...guard, async (req, res): Promise<void> => {
  const { businessId, userRole } = req as AuthedRequest;
  try {
    const body = z.object({
      username: z.string().min(2),
      password: z.string().min(6),
      role: z.enum(["owner", "admin", "manager", "staff", "accountant"]),
      displayName: z.string().nullable().optional(),
      employeeId: z.string().uuid().nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.errors[0]?.message }); return; }

    if (body.data.role === "owner" && userRole !== "owner") {
      res.status(403).json({ error: "Only the owner can create another owner account" }); return;
    }

    const passwordHash = await bcrypt.hash(body.data.password, 12);
    const [user] = await db.insert(appUsersTable).values({
      businessId,
      username: body.data.username,
      passwordHash,
      role: body.data.role,
      displayName: body.data.displayName ?? null,
      employeeId: body.data.employeeId ?? null,
    }).returning(SAFE_COLS);

    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Username already taken" }); return; }
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// PATCH /app-users/:id — edit role, displayName, password, active
router.patch("/app-users/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId, userId, userRole } = req as AuthedRequest;
  const targetId = req.params["id"] as string;
  try {
    const body = z.object({
      role: z.enum(["owner", "admin", "manager", "staff", "accountant"]).optional(),
      displayName: z.string().nullable().optional(),
      password: z.string().min(6).nullable().optional(),
      active: z.boolean().optional(),
      employeeId: z.string().uuid().nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.errors[0]?.message }); return; }

    // Cannot deactivate yourself
    if (targetId === userId && body.data.active === false) {
      res.status(400).json({ error: "You cannot deactivate your own account" }); return;
    }

    // Load the target user to check their current role
    const [target] = await db.select({ role: appUsersTable.role })
      .from(appUsersTable)
      .where(and(eq(appUsersTable.id, targetId), tenantWhere(appUsersTable.businessId, businessId)));
    if (!target) { res.status(404).json({ error: "User not found" }); return; }

    // Only owner can touch another owner's account
    if (target.role === "owner" && userRole !== "owner") {
      res.status(403).json({ error: "Only the owner can modify the owner account" }); return;
    }

    // Only owner can assign owner role (transfer ownership)
    if (body.data.role === "owner" && userRole !== "owner") {
      res.status(403).json({ error: "Only the owner can transfer ownership" }); return;
    }

    // Transfer ownership: demote current owner to admin first
    if (body.data.role === "owner" && targetId !== userId) {
      await db.update(appUsersTable)
        .set({ role: "admin" })
        .where(and(
          tenantWhere(appUsersTable.businessId, businessId),
          eq(appUsersTable.role, "owner"),
        ));
    }

    const update: Record<string, any> = {};
    if (body.data.role        !== undefined) update["role"]        = body.data.role;
    if (body.data.displayName !== undefined) update["displayName"] = body.data.displayName;
    if (body.data.active      !== undefined) update["active"]      = body.data.active;
    if (body.data.employeeId  !== undefined) update["employeeId"]  = body.data.employeeId;
    if (body.data.password)                  update["passwordHash"] = await bcrypt.hash(body.data.password, 12);

    const [user] = await db.update(appUsersTable).set(update)
      .where(and(eq(appUsersTable.id, targetId), tenantWhere(appUsersTable.businessId, businessId)))
      .returning(SAFE_COLS);

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
