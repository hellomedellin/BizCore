import { eq, and, type SQL } from "drizzle-orm";
import type { PgColumn, PgTableWithColumns } from "drizzle-orm/pg-core";

/**
 * Centralized tenant-scoping utility.
 *
 * Usage:
 *   const conditions = tenantWhere(myTable.businessId, businessId, extraCondition);
 *   db.select().from(myTable).where(conditions);
 *
 * Ensures that every query that touches a businessId-scoped table always includes
 * the tenant filter, preventing accidental cross-tenant data access.
 */
export function tenantWhere(
  businessIdColumn: PgColumn,
  businessId: number,
  ...extra: (SQL | undefined)[]
): SQL {
  const base = eq(businessIdColumn, businessId);
  const defined = extra.filter((c): c is SQL => c !== undefined);
  if (defined.length === 0) return base;
  return and(base, ...defined) as SQL;
}

/**
 * Assert that a businessId is present and return it, or throw.
 * Use this in route handlers to guard against missing context.
 */
export function assertBusinessId(businessId: number | undefined): number {
  if (!businessId) {
    const err = new Error("No business context found for this user") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  return businessId;
}
