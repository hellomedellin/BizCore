import { Router } from "express";
import { db } from "@bizcore/db";
import { appUsersTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAuth, loadBusiness, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const adminOnly = [requireAuth, loadBusiness, requireRole("admin")];

// GET /app-users — list all users for the business
router.get("/app-users", ...adminOnly, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const users = await db
      .select({ id: appUsersTable.id, username: appUsersTable.username, displayName: appUsersTable.displayName, role: appUsersTable.role, employeeId: appUsersTable.employeeId, active: appUsersTable.active, createdAt: appUsersTable.createdAt })
      .from(appUsersTable)
      .where(tenantWhere(appUsersTable.businessId, businessId));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// POST /app-users — create a new user
router.post("/app-users", ...adminOnly, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.object({
      username: z.string().min(2, "Username must be at least 2 characters"),
      password: z.string().min(6, "Password must be at least 6 characters"),
      role: z.enum(["admin", "manager", "staff", "accountant"]),
      displayName: z.string().nullable().optional(),
      employeeId: z.string().uuid().nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.errors[0]?.message }); return; }

    const passwordHash = await bcrypt.hash(body.data.password, 12);
    const [user] = await db.insert(appUsersTable).values({
      businessId,
      username: body.data.username,
      passwordHash,
      role: body.data.role,
      displayName: body.data.displayName ?? null,
      employeeId: body.data.employeeId ?? null,
    }).returning({ id: appUsersTable.id, username: appUsersTable.username, displayName: appUsersTable.displayName, role: appUsersTable.role, employeeId: appUsersTable.employeeId, active: appUsersTable.active });

    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Username already taken" }); return; }
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// PATCH /app-users/:id — update role, displayName, reset password
router.patch("/app-users/:id", ...adminOnly, async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const body = z.object({
      role: z.enum(["admin", "manager", "staff", "accountant"]).optional(),
      displayName: z.string().nullable().optional(),
      password: z.string().min(6).nullable().optional(),
      active: z.boolean().optional(),
      employeeId: z.string().uuid().nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.errors[0]?.message }); return; }

    // Safety: can't deactivate yourself
    if (req.params["id"] === userId && body.data.active === false) {
      res.status(400).json({ error: "You cannot deactivate your own account" }); return;
    }

    const update: Record<string, any> = {};
    if (body.data.role !== undefined) update["role"] = body.data.role;
    if (body.data.displayName !== undefined) update["displayName"] = body.data.displayName;
    if (body.data.active !== undefined) update["active"] = body.data.active;
    if (body.data.employeeId !== undefined) update["employeeId"] = body.data.employeeId;
    if (body.data.password) update["passwordHash"] = await bcrypt.hash(body.data.password, 12);

    const [user] = await db
      .update(appUsersTable)
      .set(update)
      .where(and(eq(appUsersTable.id, req.params["id"] as string), tenantWhere(appUsersTable.businessId, businessId)))
      .returning({ id: appUsersTable.id, username: appUsersTable.username, displayName: appUsersTable.displayName, role: appUsersTable.role, employeeId: appUsersTable.employeeId, active: appUsersTable.active });

    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
