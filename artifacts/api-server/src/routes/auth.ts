import { Router } from "express";
import { db } from "@bizcore/db";
import { appUsersTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signToken } from "../lib/jwt";
import { requireAuth, type AuthedRequest } from "../middlewares/auth";

const router = Router();

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const body = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Username and password are required" }); return; }

    const [user] = await db
      .select()
      .from(appUsersTable)
      .where(and(eq(appUsersTable.username, body.data.username), eq(appUsersTable.active, true)))
      .limit(1);

    if (!user) { res.status(401).json({ error: "Invalid username or password" }); return; }

    const valid = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid username or password" }); return; }

    const token = signToken({
      sub: user.id,
      businessId: user.businessId,
      role: user.role,
      employeeId: user.employeeId ?? undefined,
      username: user.username,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        businessId: user.businessId,
        employeeId: user.employeeId,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// GET /auth/me — return current user info from token
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  try {
    const [user] = await db
      .select({ id: appUsersTable.id, username: appUsersTable.username, displayName: appUsersTable.displayName, role: appUsersTable.role, businessId: appUsersTable.businessId, employeeId: appUsersTable.employeeId })
      .from(appUsersTable)
      .where(eq(appUsersTable.id, userId))
      .limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// POST /auth/change-password
router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { userId } = req as AuthedRequest;
  try {
    const body = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6, "Password must be at least 6 characters"),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.errors[0]?.message }); return; }

    const [user] = await db.select().from(appUsersTable).where(eq(appUsersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const valid = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }

    const passwordHash = await bcrypt.hash(body.data.newPassword, 12);
    await db.update(appUsersTable).set({ passwordHash }).where(eq(appUsersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
