import {
  pgTable, pgEnum, text, uuid, timestamp, boolean, numeric, date, integer, unique, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { businessesTable, locationsTable, usersTable } from "./businesses";

export const timeEntryTypeEnum = pgEnum("time_entry_type", [
  "regular", "overtime", "sick", "vacation", "unpaid_leave", "holiday",
]);

export const timeEntryStatusEnum = pgEnum("time_entry_status", [
  "pending", "approved", "rejected",
]);

export const timeOffRequestTypeEnum = pgEnum("time_off_request_type", [
  "vacation", "sick", "personal", "unpaid",
]);

export const timeOffRequestStatusEnum = pgEnum("time_off_request_status", [
  "pending", "approved", "rejected",
]);

// ─── employee_roles ──────────────────────────────────────────────────────────

export const employeeRolesTable = pgTable("employee_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  permissionLevel: text("permission_level").default("staff"),
  hourlyRateDefault: numeric("hourly_rate_default", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("employee_roles_business_id_idx").on(t.businessId),
]);

export const insertEmployeeRoleSchema = createInsertSchema(employeeRolesTable).omit({ id: true, createdAt: true });
export type InsertEmployeeRole = z.infer<typeof insertEmployeeRoleSchema>;
export type EmployeeRole = typeof employeeRolesTable.$inferSelect;

// ─── employees ───────────────────────────────────────────────────────────────

export const employeesTable = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businessesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => usersTable.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  roleId: uuid("role_id").references(() => employeeRolesTable.id),
  primaryLocationId: uuid("primary_location_id").references(() => locationsTable.id),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  overtimeRateMultiplier: numeric("overtime_rate_multiplier", { precision: 4, scale: 2 }).default("1.50"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("employees_business_id_idx").on(t.businessId),
  index("employees_user_id_idx").on(t.userId),
]);

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;

// ─── employee_locations ──────────────────────────────────────────────────────

export const employeeLocationsTable = pgTable("employee_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("employee_locations_unique").on(t.employeeId, t.locationId),
  index("employee_locations_employee_id_idx").on(t.employeeId),
]);

export type EmployeeLocation = typeof employeeLocationsTable.$inferSelect;

// ─── shifts ──────────────────────────────────────────────────────────────────

export const shiftsTable = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => locationsTable.id),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shifts_employee_id_idx").on(t.employeeId),
  index("shifts_location_id_idx").on(t.locationId),
  index("shifts_start_time_idx").on(t.startTime),
]);

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({ id: true, createdAt: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shiftsTable.$inferSelect;

// ─── time_entries ────────────────────────────────────────────────────────────

export const timeEntriesTable = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").references(() => locationsTable.id),
  shiftId: uuid("shift_id").references(() => shiftsTable.id),
  entryType: timeEntryTypeEnum("entry_type").notNull().default("regular"),
  clockIn: timestamp("clock_in", { withTimezone: true }).notNull(),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  breakMinutes: integer("break_minutes").notNull().default(0),
  totalMinutes: integer("total_minutes"),
  hourlyRateSnapshot: numeric("hourly_rate_snapshot", { precision: 10, scale: 2 }),
  overtimeRateSnapshot: numeric("overtime_rate_snapshot", { precision: 4, scale: 2 }),
  status: timeEntryStatusEnum("status").notNull().default("pending"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("time_entries_employee_id_idx").on(t.employeeId),
  index("time_entries_status_idx").on(t.status),
  index("time_entries_clock_in_idx").on(t.clockIn),
]);

export const insertTimeEntrySchema = createInsertSchema(timeEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntriesTable.$inferSelect;

// ─── time_off_requests ───────────────────────────────────────────────────────

export const timeOffRequestsTable = pgTable("time_off_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  requestType: timeOffRequestTypeEnum("request_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  notes: text("notes"),
  status: timeOffRequestStatusEnum("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("time_off_requests_employee_id_idx").on(t.employeeId),
  index("time_off_requests_status_idx").on(t.status),
]);

export const insertTimeOffRequestSchema = createInsertSchema(timeOffRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTimeOffRequest = z.infer<typeof insertTimeOffRequestSchema>;
export type TimeOffRequest = typeof timeOffRequestsTable.$inferSelect;

// ─── employee_default_shifts ──────────────────────────────────────────────────
// One row per employee per day-of-week. 0 = Sunday, 1 = Monday, …, 6 = Saturday.
// startTime / endTime stored as "HH:MM" 24-hour strings.

export const employeeDefaultShiftsTable = pgTable("employee_default_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
}, (t) => [
  unique("employee_default_shifts_day_unique").on(t.employeeId, t.dayOfWeek),
  index("employee_default_shifts_employee_id_idx").on(t.employeeId),
]);

export type EmployeeDefaultShift = typeof employeeDefaultShiftsTable.$inferSelect;
