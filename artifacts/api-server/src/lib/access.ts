import { and, eq } from "drizzle-orm";
import { locationsTable } from "@bizcore/db/schema";

// Verifies a location belongs to the business AND — if the user is location-scoped
// (allowedLocationIds !== null) — is within their allowed set. Returns false if
// the location is unknown, belongs to another tenant, or is out of the user's scope.
export async function isLocationAllowed(
  dbOrTx: { select: (...args: unknown[]) => any },
  businessId: string,
  allowedLocationIds: string[] | null,
  locationId: string,
): Promise<boolean> {
  if (allowedLocationIds && !allowedLocationIds.includes(locationId)) return false;
  const [loc] = await dbOrTx
    .select({ id: locationsTable.id })
    .from(locationsTable)
    .where(and(eq(locationsTable.id, locationId), eq(locationsTable.businessId, businessId)))
    .limit(1);
  return !!loc;
}
