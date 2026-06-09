import {
  pgTable, pgEnum, text, uuid, timestamp, boolean, numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const unitTypeEnum = pgEnum("unit_type", [
  "mass", "volume", "length", "count", "time",
]);

// Global table — no business_id. Seeded at deployment, shared across all tenants.
export const unitsTable = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  unitType: unitTypeEnum("unit_type").notNull(),
  conversionToBase: numeric("conversion_to_base", { precision: 18, scale: 8 }).notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUnitSchema = createInsertSchema(unitsTable).omit({ id: true, createdAt: true });
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type Unit = typeof unitsTable.$inferSelect;
