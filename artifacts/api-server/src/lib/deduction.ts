import type { DB } from "@bizcore/db";
import {
  consumptionProfilesTable, consumptionProfileLinesTable,
  inventoryTransactionsTable, inventoryTable, itemsTable, itemVariantsTable,
} from "@bizcore/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

/**
 * Applies consumption profiles for all lines in a completed order.
 * Runs inside a single DB transaction — all succeed or all fail.
 */
export async function applyOrderDeductions(
  tx: Parameters<Parameters<DB["transaction"]>[0]>[0],
  orderId: string,
  orderLines: Array<{ variantId: string | null; quantity: string; name: string }>,
): Promise<void> {
  for (const line of orderLines) {
    if (!line.variantId) continue;

    const [variant] = await tx
      .select({ itemId: itemVariantsTable.itemId })
      .from(itemVariantsTable)
      .where(eq(itemVariantsTable.id, line.variantId));
    if (!variant) continue;

    const [item] = await tx
      .select({ type: itemsTable.type })
      .from(itemsTable)
      .where(eq(itemsTable.id, variant.itemId));

    // Look for variant-specific profile first, then item-level fallback
    const [profile] = await tx
      .select({ id: consumptionProfilesTable.id })
      .from(consumptionProfilesTable)
      .where(
        and(
          eq(consumptionProfilesTable.outputItemId, variant.itemId),
          eq(consumptionProfilesTable.outputVariantId, line.variantId),
          eq(consumptionProfilesTable.active, true),
        ),
      )
      .limit(1);

    const [fallbackProfile] = !profile
      ? await tx
          .select({ id: consumptionProfilesTable.id })
          .from(consumptionProfilesTable)
          .where(
            and(
              eq(consumptionProfilesTable.outputItemId, variant.itemId),
              isNull(consumptionProfilesTable.outputVariantId),
              eq(consumptionProfilesTable.active, true),
            ),
          )
          .limit(1)
      : [undefined];

    const activeProfile = profile ?? fallbackProfile;

    if (!activeProfile && item?.type === "product") {
      // No profile: direct deduction of 1 unit per quantity ordered
      await tx.insert(inventoryTransactionsTable).values({
        variantId: line.variantId,
        locationId: "", // locationId comes from order — caller should pass it
        type: "consume",
        quantityChange: `-${line.quantity}`,
        referenceType: "order",
        referenceId: orderId,
        createdBy: "system",
      });
      continue;
    }

    if (!activeProfile) continue;

    const profileLines = await tx
      .select()
      .from(consumptionProfileLinesTable)
      .where(eq(consumptionProfileLinesTable.profileId, activeProfile.id));

    for (const pl of profileLines) {
      if (pl.lineType === "resource" && pl.resourceVariantId && pl.quantity) {
        const consumed = (parseFloat(pl.quantity) * parseFloat(line.quantity)).toFixed(4);
        await tx.insert(inventoryTransactionsTable).values({
          variantId: pl.resourceVariantId,
          locationId: "", // set by caller
          type: "consume",
          quantityChange: `-${consumed}`,
          unitId: pl.unitId ?? null,
          referenceType: "order",
          referenceId: orderId,
          createdBy: "system",
        });

        // Update inventory balance
        await tx
          .insert(inventoryTable)
          .values({ variantId: pl.resourceVariantId, locationId: "", quantity: `-${consumed}` })
          .onConflictDoUpdate({
            target: [inventoryTable.variantId, inventoryTable.locationId],
            set: { quantity: sql`${inventoryTable.quantity} - ${consumed}` },
          });
      }
    }
  }
}
