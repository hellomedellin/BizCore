import {
  pgTable, pgEnum, text, uuid, timestamp, numeric, boolean, index, unique,
} from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";
import { businessesTable } from "./businesses";

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash", "card", "transfer", "nequi", "daviplata", "other",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "completed", "refunded",
]);

export const paymentPosSourceEnum = pgEnum("payment_pos_source", [
  "manual", "pos_sync", "siigo_sync",
]);

// ─── payments ─────────────────────────────────────────────────────────────────

export const paymentsTable = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  businessId: uuid("business_id").notNull(),
  locationId: uuid("location_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  tip: numeric("tip", { precision: 10, scale: 2 }).notNull().default("0"),
  currencyCode: text("currency_code").notNull().default("USD"),
  method: paymentMethodEnum("method").notNull(),
  status: paymentStatusEnum("status").notNull().default("completed"),
  externalTransactionId: text("external_transaction_id"),
  posSource: paymentPosSourceEnum("pos_source").notNull().default("manual"),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("payments_order_id_idx").on(t.orderId),
  index("payments_business_id_idx").on(t.businessId),
  index("payments_business_created_at_idx").on(t.businessId, t.createdAt),
]);

export type Payment = typeof paymentsTable.$inferSelect;

// ─── pos_connections ──────────────────────────────────────────────────────────
// One POS integration config per business. BizCore polls {apiUrl}/transactions
// when doing a sync. The POS must respond with the standard contract:
// { transactions: [{ id, bizcore_order_id?, amount, tip?, currency, method, processedAt }] }

export const posConnectionsTable = pgTable("pos_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  apiUrl: text("api_url").notNull(),
  apiKey: text("api_key"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("pos_connections_business_id_unique").on(t.businessId),
]);

export type PosConnection = typeof posConnectionsTable.$inferSelect;

// ─── siigo_connections ────────────────────────────────────────────────────────
// Siigo is a Colombian accounting/ERP platform. BizCore pulls completed sales
// invoices (with DIAN CUFE stamps) via Siigo's REST API and imports them as
// completed orders + payments.

export const siigoConnectionsTable = pgTable("siigo_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  accessKey: text("access_key").notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("siigo_connections_business_id_unique").on(t.businessId),
]);

export type SiigoConnection = typeof siigoConnectionsTable.$inferSelect;

// ─── cash_reconciliations ─────────────────────────────────────────────────────
// An end-of-shift cash count. expectedCash is the sum of cash payments at the
// location since the previous reconciliation; countedCash is what the manager
// physically counted; variance = counted − expected (negative = drawer short).

export const cashReconciliationsTable = pgTable("cash_reconciliations", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }).notNull(),
  countedCash: numeric("counted_cash", { precision: 12, scale: 2 }).notNull(),
  variance: numeric("variance", { precision: 12, scale: 2 }).notNull(),
  denominations: text("denominations"), // JSON string: { "50000": 4, "10000": 7, … }
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("cash_recon_business_location_idx").on(t.businessId, t.locationId),
]);

export type CashReconciliation = typeof cashReconciliationsTable.$inferSelect;
