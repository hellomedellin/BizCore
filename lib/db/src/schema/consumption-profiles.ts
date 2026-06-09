import {
  pgTable, pgEnum, text, uuid, timestamp, boolean, numeric, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { businessesTable } from "./businesses";
import { itemsTable, itemVariantsTable } from "./items";
import { unitsTable } from "./units";

export const profileLineTypeEnum = pgEnum("profile_line_type", ["resource", "labor"]);

// ─── consumption_profiles ────────────────────────────────────────────────────

export const consumptionProfilesTable = pgTable("consumption_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  outputItemId: uuid("output_item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
  outputVariantId: uuid("output_variant_id").references(() => itemVariantsTable.id, { onDelete: "cascade" }),
  name: text("name"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("cp_business_id_idx").on(t.businessId),
  index("cp_output_item_id_idx").on(t.outputItemId),
]);

export const insertConsumptionProfileSchema = createInsertSchema(consumptionProfilesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConsumptionProfile = z.infer<typeof insertConsumptionProfileSchema>;
export type ConsumptionProfile = typeof consumptionProfilesTable.$inferSelect;

// ─── consumption_profile_lines ───────────────────────────────────────────────
// All columns except id, profile_id, line_type, created_at are nullable.
// Application layer validates that resource lines have resource_variant_id + quantity + unit_id,
// and labor lines have labor_minutes.

export const consumptionProfileLinesTable = pgTable("consumption_profile_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => consumptionProfilesTable.id, { onDelete: "cascade" }),
  lineType: profileLineTypeEnum("line_type").notNull(),

  // resource line fields (null when line_type = "labor")
  resourceVariantId: uuid("resource_variant_id").references(() => itemVariantsTable.id),
  quantity: numeric("quantity", { precision: 10, scale: 4 }),
  unitId: uuid("unit_id").references(() => unitsTable.id),

  // labor line fields (null when line_type = "resource")
  roleId: uuid("role_id"),  // FK to employee_roles — set via application after employees schema loads
  laborMinutes: numeric("labor_minutes", { precision: 8, scale: 2 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("cpl_profile_id_idx").on(t.profileId),
]);

export const insertConsumptionProfileLineSchema = createInsertSchema(consumptionProfileLinesTable).omit({ id: true, createdAt: true });
export type InsertConsumptionProfileLine = z.infer<typeof insertConsumptionProfileLineSchema>;
export type ConsumptionProfileLine = typeof consumptionProfileLinesTable.$inferSelect;
