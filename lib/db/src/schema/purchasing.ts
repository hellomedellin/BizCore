import {
  pgTable, pgEnum, text, uuid, timestamp, boolean, numeric, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { businessesTable, locationsTable } from "./businesses";
import { itemVariantsTable } from "./items";
import { unitsTable } from "./units";

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft", "ai_processing", "ai_complete", "pending_review", "submitted", "received", "cancelled",
]);

export const purchaseOrderSourceEnum = pgEnum("purchase_order_source", [
  "manual", "invoice_ai",
]);

// ─── suppliers ───────────────────────────────────────────────────────────────

export const suppliersTable = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("suppliers_business_id_idx").on(t.businessId),
]);

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;

// ─── purchase_orders ─────────────────────────────────────────────────────────

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id),
  supplierId: uuid("supplier_id").references(() => suppliersTable.id),
  status: purchaseOrderStatusEnum("status").notNull().default("draft"),
  source: purchaseOrderSourceEnum("source").notNull().default("manual"),
  invoiceUrl: text("invoice_url"),
  notes: text("notes"),
  // Purchase-capture / accounting fields.
  taxId: text("tax_id"),                       // vendor tax ID (nullable — some receipts have none)
  expenseCategory: text("expense_category"),   // accounting bucket (e.g. cleaning supplies, food)
  receiptMissing: boolean("receipt_missing").notNull().default(false),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  expectedAt: timestamp("expected_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("purchase_orders_business_id_idx").on(t.businessId),
  index("purchase_orders_status_idx").on(t.status),
]);

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrdersTable.$inferSelect;

// ─── purchase_order_lines ────────────────────────────────────────────────────

export const purchaseOrderLinesTable = pgTable("purchase_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
  variantId: uuid("variant_id").references(() => itemVariantsTable.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unitId: uuid("unit_id").references(() => unitsTable.id),
  unitCost: numeric("unit_cost", { precision: 10, scale: 4 }).notNull(),
  lineTotal: numeric("line_total", { precision: 10, scale: 2 }).notNull(),
  matched: boolean("matched").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("po_lines_purchase_order_id_idx").on(t.purchaseOrderId),
]);

export const insertPurchaseOrderLineSchema = createInsertSchema(purchaseOrderLinesTable).omit({ id: true, createdAt: true });
export type InsertPurchaseOrderLine = z.infer<typeof insertPurchaseOrderLineSchema>;
export type PurchaseOrderLine = typeof purchaseOrderLinesTable.$inferSelect;
