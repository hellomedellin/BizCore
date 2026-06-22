import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { db } from "@bizcore/db";
import { appUsersTable, businessModulesTable, employeesTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";

export interface AuthedRequest extends Request {
  userId: string;          // appUser.id
  businessId: string;
  userRole: string;
  allowedLocationIds: string[] | null;
  employeeId?: string;
  // legacy compat
  businessUserId?: string;
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    const authed = req as AuthedRequest;
    authed.userId = payload.sub;
    authed.businessId = payload.businessId;
    authed.userRole = payload.role;
    authed.employeeId = payload.employeeId;
    authed.allowedLocationIds = null; // all locations; location scoping added later
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── loadBusiness ─────────────────────────────────────────────────────────────
// businessId is already in the JWT — this is a no-op kept for route compatibility.

export function loadBusiness(req: Request, res: Response, next: NextFunction): void {
  next();
}

// ─── requireRole ─────────────────────────────────────────────────────────────

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authed = req as AuthedRequest;
    // owner bypasses every role check — they have full access
    if (authed.userRole === "owner" || roles.includes(authed.userRole)) {
      next();
      return;
    }
    res.status(403).json({ error: "Insufficient permissions" });
  };
}

// ─── requireModule ────────────────────────────────────────────────────────────

export function requireModule(moduleName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authed = req as AuthedRequest;
    void (async () => {
      try {
        const [mod] = await db
          .select({ enabled: businessModulesTable.enabled })
          .from(businessModulesTable)
          .where(
            and(
              eq(businessModulesTable.businessId, authed.businessId),
              eq(businessModulesTable.module, moduleName as any),
              eq(businessModulesTable.enabled, true),
            ),
          )
          .limit(1);
        if (!mod) {
          res.status(403).json({ error: `Module '${moduleName}' is not enabled` });
          return;
        }
        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}

// ─── loadEmployee ─────────────────────────────────────────────────────────────
// For /me/* routes. Uses employeeId already in the JWT payload.

export function loadEmployee(req: Request, res: Response, next: NextFunction): void {
  const authed = req as AuthedRequest;
  if (!authed.employeeId) {
    // Admin/accountant users without an employee record can still access /me for profile
    // but not clock-in/out. The individual route handlers check employeeId where needed.
    next();
    return;
  }
  void (async () => {
    try {
      const [emp] = await db
        .select({ id: employeesTable.id, businessId: employeesTable.businessId })
        .from(employeesTable)
        .where(and(eq(employeesTable.id, authed.employeeId!), eq(employeesTable.active, true)))
        .limit(1);
      if (!emp) {
        res.status(403).json({ error: "Employee record not found or inactive" });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  })();
}

// ─── requireApiKey ────────────────────────────────────────────────────────────

import { apiKeysTable } from "@bizcore/db/schema";
import crypto from "crypto";

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const rawKey = req.headers["x-api-key"] as string | undefined;
  if (!rawKey) {
    res.status(401).json({ error: "API key required" });
    return;
  }
  void (async () => {
    try {
      const prefix = rawKey.substring(0, 8);
      const hash = crypto.createHash("sha256").update(rawKey).digest("hex");
      const [key] = await db
        .select()
        .from(apiKeysTable)
        .where(and(eq(apiKeysTable.keyPrefix, prefix), eq(apiKeysTable.keyHash, hash), eq(apiKeysTable.active, true)))
        .limit(1);
      if (!key) {
        res.status(401).json({ error: "Invalid or inactive API key" });
        return;
      }
      void db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, key.id));
      const authed = req as AuthedRequest;
      authed.businessId = key.businessId;
      authed.userRole = "api";
      authed.allowedLocationIds = key.locationId ? [key.locationId] : null;
      next();
    } catch (err) {
      next(err);
    }
  })();
}
