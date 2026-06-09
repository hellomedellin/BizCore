import {
  pgTable, pgEnum, text, uuid, timestamp, numeric, jsonb, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { businessesTable, locationsTable } from "./businesses";
import { customersTable } from "./customers";
import { itemVariantsTable } from "./items";

export const orderTypeEnum = pgEnum("order_type", [
  "dine_in", "pickup", "delivery", "service", "retail",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending", "confirmed", "in_progress", "ready", "completed", "cancelled",
]);

export const orderSourceEnum = pgEnum("order_source", ["internal", "api"]);

// ─── orders ──────────────────────────────────────────────────────────────────

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id),
  customerId: uuid("customer_id").references(() => customersTable.id),
  orderType: orderTypeEnum("order_type").notNull().default("retail"),
  status: orderStatusEnum("status").notNull().default("pending"),
  source: orderSourceEnum("source").notNull().default("internal"),
  externalRef: text("external_ref"),
  tableNumber: text("table_number"),
  notes: text("notes"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  currencyCode: text("currency_code").notNull().default("USD"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("orders_business_id_idx").on(t.businessId),
  index("orders_business_created_at_idx").on(t.businessId, t.createdAt),
  index("orders_location_id_idx").on(t.locationId),
  index("orders_status_idx").on(t.status),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

// ─── order_lines ─────────────────────────────────────────────────────────────

export const orderLinesTable = pgTable("order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => itemVariantsTable.id),
  name: text("name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  modifiers: jsonb("modifiers"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("order_lines_order_id_idx").on(t.orderId),
]);

export const insertOrderLineSchema = createInsertSchema(orderLinesTable).omit({ id: true, createdAt: true });
export type InsertOrderLine = z.infer<typeof insertOrderLineSchema>;
export type OrderLine = typeof orderLinesTable.$inferSelect;

// ─── order_status_history ────────────────────────────────────────────────────

export const orderStatusHistoryTable = pgTable("order_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  fromStatus: orderStatusEnum("from_status"),
  toStatus: orderStatusEnum("to_status").notNull(),
  changedBy: text("changed_by"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("order_status_history_order_id_idx").on(t.orderId),
]);

export type OrderStatusHistory = typeof orderStatusHistoryTable.$inferSelect;
