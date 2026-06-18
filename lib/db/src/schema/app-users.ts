import {
  pgTable, pgEnum, text, uuid, timestamp, boolean, index, unique,
} from "drizzle-orm/pg-core";
import { businessesTable } from "./businesses";

export const appUserRoleEnum = pgEnum("app_user_role", ["admin", "manager", "staff", "accountant"]);

export const appUsersTable = pgTable("app_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: appUserRoleEnum("role").notNull().default("staff"),
  displayName: text("display_name"),
  employeeId: uuid("employee_id"), // soft FK — no DB constraint to avoid circular import
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("app_users_business_username_unique").on(t.businessId, t.username),
  index("app_users_business_id_idx").on(t.businessId),
]);

export type AppUser = typeof appUsersTable.$inferSelect;
