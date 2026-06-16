import type { Request, Response, NextFunction } from "express";
import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import { db } from "@bizcore/db";
import {
  usersTable,
  businessUsersTable,
  businessUserLocationsTable,
  businessModulesTable,
  employeesTable,
} from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";

export { clerkMiddleware };

export interface AuthedRequest extends Request {
  userId: string;
  businessId: string;
  businessUserId: string;
  userRole: string;
  allowedLocationIds: string[] | null; // null = all locations
  employeeId?: string; // set on /me/* routes
}

// ─── requireAuth ─────────────────────────────────────────────────────────────
// Validates Clerk JWT, syncs user to local users table, injects userId.

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  void (async () => {
    try {
      const userId = auth.userId!;
      const [existing] = await db
        .select({ id: usersTable.id, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      // Clerk session claims omit email by default, so fetch it from the Backend
      // API on first sign-in (and backfill any previously-stored empty email).
      if (!existing || !existing.email) {
        let email = (auth as any).sessionClaims?.email ?? "";
        let name = (auth as any).sessionClaims?.name ?? null;
        try {
          const u = await clerkClient.users.getUser(userId);
          email =
            u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
            u.emailAddresses[0]?.emailAddress ??
            email;
          name = [u.firstName, u.lastName].filter(Boolean).join(" ") || name;
        } catch {
          /* fall back to session claims */
        }
        await db
          .insert(usersTable)
          .values({ id: userId, email, name })
          .onConflictDoUpdate({ target: usersTable.id, set: { email, name } });
      }

      (req as AuthedRequest).userId = userId;
      next();
    } catch (err) {
      next(err);
    }
  })();
}

// ─── loadBusiness ────────────────────────────────────────────────────────────
// Resolves businessId from the authenticated user. Requires requireAuth first.
// Injects: businessId, businessUserId, userRole, allowedLocationIds.

export function loadBusiness(req: Request, res: Response, next: NextFunction): void {
  const authed = req as AuthedRequest;

  void (async () => {
    try {
      const [businessUser] = await db
        .select()
        .from(businessUsersTable)
        .where(
          and(
            eq(businessUsersTable.userId, authed.userId),
            eq(businessUsersTable.active, true),
          ),
        )
        .limit(1);

      if (!businessUser) {
        res.status(403).json({ error: "No business account found" });
        return;
      }

      // Location scoping: 0 rows = all locations; rows present = restricted
      const locationRows = await db
        .select({ locationId: businessUserLocationsTable.locationId })
        .from(businessUserLocationsTable)
        .where(eq(businessUserLocationsTable.businessUserId, businessUser.id));

      authed.businessId = businessUser.businessId;
      authed.businessUserId = businessUser.id;
      authed.userRole = businessUser.role;
      authed.allowedLocationIds = locationRows.length > 0
        ? locationRows.map((r) => r.locationId)
        : null;

      next();
    } catch (err) {
      next(err);
    }
  })();
}

// ─── requireRole ─────────────────────────────────────────────────────────────

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authed = req as AuthedRequest;
    if (!roles.includes(authed.userRole)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

// ─── requireModule ───────────────────────────────────────────────────────────

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
          res.status(403).json({ error: `Module '${moduleName}' is not enabled for this business` });
          return;
        }
        next();
      } catch (err) {
        next(err);
      }
    })();
  };
}

// ─── loadEmployee ────────────────────────────────────────────────────────────
// For /me/* routes. Resolves employeeId from userId.
// Requires X-Business-Id header if user works at multiple businesses.

export function loadEmployee(req: Request, res: Response, next: NextFunction): void {
  const authed = req as AuthedRequest;

  void (async () => {
    try {
      const employees = await db
        .select()
        .from(employeesTable)
        .where(
          and(
            eq(employeesTable.userId, authed.userId),
            eq(employeesTable.active, true),
          ),
        );

      if (employees.length === 0) {
        res.status(403).json({ error: "No employee profile found for this account" });
        return;
      }

      let employee = employees[0]!;

      if (employees.length > 1) {
        const businessIdHeader = req.headers["x-business-id"] as string | undefined;
        if (!businessIdHeader) {
          res.status(400).json({
            error: "Multiple businesses found. Provide X-Business-Id header.",
            businesses: employees.map((e) => e.businessId),
          });
          return;
        }
        const match = employees.find((e) => e.businessId === businessIdHeader);
        if (!match) {
          res.status(403).json({ error: "Employee not found in specified business" });
          return;
        }
        employee = match;
      }

      authed.businessId = employee.businessId;
      authed.employeeId = employee.id;
      next();
    } catch (err) {
      next(err);
    }
  })();
}

// ─── requireApiKey ───────────────────────────────────────────────────────────
// Alternative auth path for external POS integrations.

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
        .where(
          and(
            eq(apiKeysTable.keyPrefix, prefix),
            eq(apiKeysTable.keyHash, hash),
            eq(apiKeysTable.active, true),
          ),
        )
        .limit(1);

      if (!key) {
        res.status(401).json({ error: "Invalid or inactive API key" });
        return;
      }

      // Update last used timestamp (fire and forget)
      void db
        .update(apiKeysTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeysTable.id, key.id));

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
