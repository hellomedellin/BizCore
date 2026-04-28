import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { itemsTable, itemVariantsTable } from "./items";

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  menuItemId: integer("menu_item_id").notNull().references(() => itemsTable.id, { onDelete: "cascade" }),
  name: text("name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRecipeSchema = createInsertSchema(recipesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipesTable.$inferSelect;

export const recipeItemsTable = pgTable("recipe_items", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipe_id").notNull().references(() => recipesTable.id, { onDelete: "cascade" }),
  ingredientVariantId: integer("ingredient_variant_id").notNull().references(() => itemVariantsTable.id),
  quantity: numeric("quantity", { precision: 10, scale: 4 }).notNull(),
  unit: text("unit"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecipeItemSchema = createInsertSchema(recipeItemsTable).omit({ id: true, createdAt: true });
export type InsertRecipeItem = z.infer<typeof insertRecipeItemSchema>;
export type RecipeItem = typeof recipeItemsTable.$inferSelect;
