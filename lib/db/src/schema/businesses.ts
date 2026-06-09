import {
  pgTable, pgEnum, text, uuid, timestamp, boolean, jsonb, unique, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const businessUserRoleEnum = pgEnum("business_user_role", [
  "owner", "admin", "manager", "staff", "viewer",
]);

export const locationTypeEnum = pgEnum("location_type", [
  "restaurant", "retail", "service", "warehouse", "office",
]);

export const moduleKeyEnum = pgEnum("module_key", [
  "inventory",
  "consumption_profiles",
  "orders",
  "customers",
  "employees",
  "time_tracking",
  "scheduling",
  "purchasing",
  "invoice_ai",
  "reporting",
  "api_access",
]);

// ─── businesses ──────────────────────────────────────────────────────────────

export const businessesTable = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  timezone: text("timezone").notNull().default("America/New_York"),
  logoUrl: text("logo_url"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("businesses_owner_user_id_idx").on(t.ownerUserId),
]);

export const insertBusinessSchema = createInsertSchema(businessesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectBusinessSchema = createSelectSchema(businessesTable);
export type InsertBusiness = z.infer<typeof insertBusinessSchema>;
export type Business = z.infer<typeof selectBusinessSchema>;

// ─── locations ───────────────────────────────────────────────────────────────

export const locationsTable = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: locationTypeEnum("type").notNull().default("restaurant"),
  address: text("address"),
  phone: text("phone"),
  timezone: text("timezone").notNull().default("America/New_York"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("locations_business_id_idx").on(t.businessId),
]);

export const insertLocationSchema = createInsertSchema(locationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectLocationSchema = createSelectSchema(locationsTable);
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = z.infer<typeof selectLocationSchema>;

// ─── business_modules ────────────────────────────────────────────────────────

export const businessModulesTable = pgTable("business_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  module: moduleKeyEnum("module").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  configuration: jsonb("configuration"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("business_modules_unique").on(t.businessId, t.module),
  index("business_modules_business_id_idx").on(t.businessId),
]);

export const insertBusinessModuleSchema = createInsertSchema(businessModulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBusinessModule = z.infer<typeof insertBusinessModuleSchema>;
export type BusinessModule = typeof businessModulesTable.$inferSelect;

// ─── users ───────────────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type User = typeof usersTable.$inferSelect;

// ─── business_users ──────────────────────────────────────────────────────────

export const businessUsersTable = pgTable("business_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: businessUserRoleEnum("role").notNull().default("staff"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("business_users_unique").on(t.businessId, t.userId),
  index("business_users_business_id_idx").on(t.businessId),
  index("business_users_user_id_idx").on(t.userId),
]);

export const insertBusinessUserSchema = createInsertSchema(businessUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBusinessUser = z.infer<typeof insertBusinessUserSchema>;
export type BusinessUser = typeof businessUsersTable.$inferSelect;

// ─── business_user_locations ─────────────────────────────────────────────────

export const businessUserLocationsTable = pgTable("business_user_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessUserId: uuid("business_user_id").notNull().references(() => businessUsersTable.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("business_user_locations_unique").on(t.businessUserId, t.locationId),
  index("business_user_locations_bu_idx").on(t.businessUserId),
]);

export type BusinessUserLocation = typeof businessUserLocationsTable.$inferSelect;
