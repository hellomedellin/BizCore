import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { businessUsersTable, businessesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export type AuthedRequest = Request & {
  userId: string;
  businessId?: number;
  userRole?: string;
};

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
};

export const loadBusiness = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authedReq = req as AuthedRequest;
  const userId = authedReq.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const businessUser = await db
    .select()
    .from(businessUsersTable)
    .where(
      and(
        eq(businessUsersTable.userId, userId),
        eq(businessUsersTable.active, true),
      ),
    )
    .limit(1);

  if (businessUser.length === 0) {
    const ownedBusiness = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.ownerUserId, userId))
      .limit(1);

    if (ownedBusiness.length > 0) {
      authedReq.businessId = ownedBusiness[0].id;
      authedReq.userRole = "admin";
    }
  } else {
    authedReq.businessId = businessUser[0].businessId;
    authedReq.userRole = businessUser[0].role;
  }

  next();
};

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const authedReq = req as AuthedRequest;
    const role = authedReq.userRole;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
