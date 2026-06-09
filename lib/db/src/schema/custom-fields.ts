import {
  pgTable, pgEnum, text, uuid, timestamp, boolean, jsonb, integer, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { businessesTable } from "./businesses";

export const customFieldEntityTypeEnum = pgEnum("custom_field_entity_type", [
  "item", "order", "customer", "employee",
]);

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text", "number", "boolean", "date", "select",
]);

// ─── custom_fields ───────────────────────────────────────────────────────────

export const customFieldsTable = pgTable("custom_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  entityType: customFieldEntityTypeEnum("entity_type").notNull(),
  name: text("name").notNull(),
  fieldType: customFieldTypeEnum("field_type").notNull().default("text"),
  options: jsonb("options"),
  required: boolean("required").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("custom_fields_business_entity_idx").on(t.businessId, t.entityType),
]);

export const insertCustomFieldSchema = createInsertSchema(customFieldsTable).omit({ id: true, createdAt: true });
export type InsertCustomField = z.infer<typeof insertCustomFieldSchema>;
export type CustomField = typeof customFieldsTable.$inferSelect;

// ─── custom_field_values ─────────────────────────────────────────────────────

export const customFieldValuesTable = pgTable("custom_field_values", {
  id: uuid("id").primaryKey().defaultRandom(),
  customFieldId: uuid("custom_field_id").notNull().references(() => customFieldsTable.id, { onDelete: "cascade" }),
  entityId: uuid("entity_id").notNull(),
  value: text("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("cfv_custom_field_id_idx").on(t.customFieldId),
  index("cfv_entity_id_idx").on(t.entityId),
]);

export const insertCustomFieldValueSchema = createInsertSchema(customFieldValuesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomFieldValue = z.infer<typeof insertCustomFieldValueSchema>;
export type CustomFieldValue = typeof customFieldValuesTable.$inferSelect;
