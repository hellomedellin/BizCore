import { db } from "@bizcore/db";
import {
  ordersTable,
  orderLinesTable,
  orderStatusHistoryTable,
  inventoryTable,
  inventoryTransactionsTable,
  itemVariantsTable,
  itemsTable,
  consumptionProfilesTable,
  consumptionProfileLinesTable,
} from "@bizcore/db/schema";
import { eq, and, ne, isNull, sql } from "drizzle-orm";
import { tenantWhere } from "./tenant";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Atomically moves an order to "completed" and deducts inventory via its
 * consumption profiles. The WHERE status != 'completed' guard means this is
 * safe to call multiple times — only the first call actually applies the change
 * and deducts stock.
 *
 * Returns true if this call was the one that completed the order (i.e. stock
 * was deducted). Returns false if the order was already completed.
 */
export async function completeOrderInTx(
  tx: Tx,
  order: { id: string; status: string; locationId: string },
  businessId: string,
  changedBy: string,
): Promise<boolean> {
  const won = await tx
    .update(ordersTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(and(eq(ordersTable.id, order.id), ne(ordersTable.status, "completed")))
    .returning({ id: ordersTable.id });

  if (won.length === 0) return false;

  await tx.insert(orderStatusHistoryTable).values({
    orderId: order.id,
    fromStatus: order.status as any,
    toStatus: "completed",
    changedBy,
  });

  const lines = await tx
    .select()
    .from(orderLinesTable)
    .where(eq(orderLinesTable.orderId, order.id));

  for (const line of lines) {
    if (!line.variantId) continue;

    const [variant] = await tx
      .select({ itemId: itemVariantsTable.itemId })
      .from(itemVariantsTable)
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(and(eq(itemVariantsTable.id, line.variantId), tenantWhere(itemsTable.businessId, businessId)));
    if (!variant) continue;

    // Recipe lookup: variant-specific profile first, then item-level fallback.
    let profile = await tx
      .select({ id: consumptionProfilesTable.id })
      .from(consumptionProfilesTable)
      .where(and(
        tenantWhere(consumptionProfilesTable.businessId, businessId),
        eq(consumptionProfilesTable.outputItemId, variant.itemId),
        eq(consumptionProfilesTable.outputVariantId, line.variantId),
        eq(consumptionProfilesTable.active, true),
      ))
      .limit(1);

    if (!profile[0]) {
      profile = await tx
        .select({ id: consumptionProfilesTable.id })
        .from(consumptionProfilesTable)
        .where(and(
          tenantWhere(consumptionProfilesTable.businessId, businessId),
          eq(consumptionProfilesTable.outputItemId, variant.itemId),
          isNull(consumptionProfilesTable.outputVariantId),
          eq(consumptionProfilesTable.active, true),
        ))
        .limit(1);
    }

    if (!profile[0]) {
      // No recipe — deduct the variant directly.
      const qty = `-${line.quantity}`;
      await tx.insert(inventoryTransactionsTable).values({
        variantId: line.variantId, locationId: order.locationId, type: "consume",
        quantityChange: qty, referenceType: "order", referenceId: order.id, createdBy: "system",
      });
      await tx
        .insert(inventoryTable)
        .values({ variantId: line.variantId, locationId: order.locationId, quantity: qty })
        .onConflictDoUpdate({
          target: [inventoryTable.variantId, inventoryTable.locationId],
          set: { quantity: sql`${inventoryTable.quantity} + ${qty}::numeric` },
        });
      continue;
    }

    const profileLines = await tx
      .select()
      .from(consumptionProfileLinesTable)
      .where(eq(consumptionProfileLinesTable.profileId, profile[0].id));

    for (const pl of profileLines) {
      if (pl.lineType === "resource" && pl.resourceVariantId && pl.quantity) {
        const consumed = `-${(parseFloat(pl.quantity) * parseFloat(line.quantity)).toFixed(3)}`;
        await tx.insert(inventoryTransactionsTable).values({
          variantId: pl.resourceVariantId, locationId: order.locationId, type: "consume",
          quantityChange: consumed, unitId: pl.unitId, referenceType: "order", referenceId: order.id, createdBy: "system",
        });
        await tx
          .insert(inventoryTable)
          .values({ variantId: pl.resourceVariantId, locationId: order.locationId, quantity: consumed })
          .onConflictDoUpdate({
            target: [inventoryTable.variantId, inventoryTable.locationId],
            set: { quantity: sql`${inventoryTable.quantity} + ${consumed}::numeric` },
          });
      }
    }
  }

  return true;
}
