import {
  pgTable, pgEnum, text, uuid, timestamp, numeric, unique, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { itemVariantsTable } from "./items";
import { locationsTable } from "./businesses";
import { unitsTable } from "./units";

export const inventoryTransactionTypeEnum = pgEnum("inventory_transaction_type", [
  "receive", "consume", "adjust", "transfer_in", "transfer_out", "waste", "return",
]);

// ─── inventory ───────────────────────────────────────────────────────────────

export const inventoryTable = pgTable("inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id").notNull().references(() => itemVariantsTable.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  unitId: uuid("unit_id").references(() => unitsTable.id),
  lowStockThreshold: numeric("low_stock_threshold", { precision: 10, scale: 3 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("inventory_variant_location_unique").on(t.variantId, t.locationId),
  index("inventory_location_id_idx").on(t.locationId),
  index("inventory_variant_id_idx").on(t.variantId),
]);

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventoryTable.$inferSelect;

// ─── inventory_transactions ──────────────────────────────────────────────────

export const inventoryTransactionsTable = pgTable("inventory_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  variantId: uuid("variant_id").notNull().references(() => itemVariantsTable.id),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id),
  type: inventoryTransactionTypeEnum("type").notNull(),
  quantityChange: numeric("quantity_change", { precision: 10, scale: 3 }).notNull(),
  unitId: uuid("unit_id").references(() => unitsTable.id),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  batchId: text("batch_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("inv_tx_variant_id_idx").on(t.variantId),
  index("inv_tx_location_id_idx").on(t.locationId),
  index("inv_tx_reference_idx").on(t.referenceType, t.referenceId),
]);

export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactionsTable).omit({ id: true, createdAt: true });
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;
