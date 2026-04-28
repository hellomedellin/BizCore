import { pgTable, text, serial, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Local users table mirrors Clerk user data for relational queries,
 * display, and audit logging. Synced on first sign-in via the /users/sync
 * endpoint called by the frontend after authentication.
 *
 * Primary key: clerkUserId (Clerk's user ID, not a serial int) to keep
 * foreign keys to Clerk IDs consistent with the rest of the codebase.
 */
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID (e.g. "user_2abc...")
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("users_email_idx").on(t.email),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
