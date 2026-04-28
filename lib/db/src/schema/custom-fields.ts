import { pgTable, text, serial, timestamp, integer, jsonb, boolean, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { businessesTable } from "./businesses";

export const customFieldsTable = pgTable("custom_fields", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("text"),
  options: jsonb("options"),
  sortOrder: integer("sort_order").default(0),
  required: boolean("required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("custom_fields_business_id_idx").on(t.businessId),
]);

export const insertCustomFieldSchema = createInsertSchema(customFieldsTable).omit({ id: true, createdAt: true });
export type InsertCustomField = z.infer<typeof insertCustomFieldSchema>;
export type CustomField = typeof customFieldsTable.$inferSelect;

export const customFieldValuesTable = pgTable("custom_field_values", {
  id: serial("id").primaryKey(),
  fieldId: integer("field_id").notNull().references(() => customFieldsTable.id, { onDelete: "cascade" }),
  entityId: integer("entity_id").notNull(),
  value: text("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("custom_field_values_field_id_idx").on(t.fieldId),
  unique("custom_field_values_field_entity_unique").on(t.fieldId, t.entityId),
]);

export const insertCustomFieldValueSchema = createInsertSchema(customFieldValuesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomFieldValue = z.infer<typeof insertCustomFieldValueSchema>;
export type CustomFieldValue = typeof customFieldValuesTable.$inferSelect;
