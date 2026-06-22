import {
  pgTable, pgEnum, text, uuid, timestamp, boolean, numeric, jsonb, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { businessesTable } from "./businesses";

export const itemTypeEnum = pgEnum("item_type", [
  "product",   // finished good sold directly (shoe, t-shirt)
  "resource",  // raw material consumed by other items (beef, oil, dye)
  "service",   // labor/time-based (haircut, oil change)
  "bundle",    // fixed set of items sold together
]);

// ─── categories ──────────────────────────────────────────────────────────────

export const categoriesTable = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  sortOrder: numeric("sort_order").default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("categories_business_id_idx").on(t.businessId),
]);

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCategorySchema = createSelectSchema(categoriesTable);
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = z.infer<typeof selectCategorySchema>;

// ─── items ───────────────────────────────────────────────────────────────────

export const itemsTable = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: itemTypeEnum("type").notNull().default("product"),
  categoryId: uuid("category_id").references(() => categoriesTable.id),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  trackInventory: boolean("track_inventory").notNull().default(true),
  hasVariants: boolean("has_variants").notNull().default(false),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("items_business_id_idx").on(t.businessId),
  index("items_business_type_idx").on(t.businessId, t.type),
]);

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectItemSchema = createSelectSchema(itemsTable);
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = z.infer<typeof selectItemSchema>;

// ─── item_variants ───────────────────────────────────────────────────────────

export const itemVariantsTable = pgTable("item_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sku: text("sku"),
  price: numeric("price", { precision: 10, scale: 2 }),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  attributes: jsonb("attributes"),
  // "86" flag: temporarily sold out during service. Distinct from `active`
  // (which is a soft-delete). An unavailable variant can't be added to an order.
  isAvailable: boolean("is_available").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("item_variants_item_id_idx").on(t.itemId),
]);

export const insertItemVariantSchema = createInsertSchema(itemVariantsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectItemVariantSchema = createSelectSchema(itemVariantsTable);
export type InsertItemVariant = z.infer<typeof insertItemVariantSchema>;
export type ItemVariant = z.infer<typeof selectItemVariantSchema>;
