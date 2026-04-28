import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { itemVariantsTable } from "./items";
import { locationsTable } from "./businesses";

export const inventoryTable = pgTable("inventory", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => itemVariantsTable.id, { onDelete: "cascade" }),
  locationId: integer("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  lowStockThreshold: numeric("low_stock_threshold", { precision: 10, scale: 3 }).default("10"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type Inventory = typeof inventoryTable.$inferSelect;

export const inventoryTransactionsTable = pgTable("inventory_transactions", {
  id: serial("id").primaryKey(),
  variantId: integer("variant_id").notNull().references(() => itemVariantsTable.id),
  locationId: integer("location_id").notNull().references(() => locationsTable.id),
  type: text("type").notNull(),
  quantityChange: numeric("quantity_change", { precision: 10, scale: 3 }).notNull(),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  batchId: text("batch_id"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactionsTable).omit({ id: true, createdAt: true });
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;
