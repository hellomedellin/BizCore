import type { SQL } from "drizzle-orm";
import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export function tenantWhere(col: PgColumn, businessId: string): SQL {
  return eq(col, businessId);
}

export function assertBusinessId(businessId: string | undefined): asserts businessId is string {
  if (!businessId) throw new Error("businessId is required but was not set by middleware");
}
