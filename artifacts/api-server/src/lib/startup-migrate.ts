import { db } from "@bizcore/db";
import { sql } from "drizzle-orm";

// Runs idempotent SQL to ensure all schema changes exist in the DB.
// Drizzle-kit push handles most migrations but can fail on enum changes
// (Postgres doesn't allow ALTER TYPE inside a transaction). This script
// runs the missing DDL directly with IF NOT EXISTS guards so it's safe
// to run on every startup.
export async function runStartupMigrations(): Promise<void> {
  try {
    // ── Enum: payment_pos_source — add siigo_sync value ──────────────────────
    // ALTER TYPE ... ADD VALUE cannot run in a transaction, so we use a
    // DO block to catch the "already exists" case gracefully.
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE payment_pos_source ADD VALUE IF NOT EXISTS 'siigo_sync';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // ── Table: siigo_connections ──────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS siigo_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        access_key TEXT NOT NULL,
        last_sync_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT siigo_connections_business_id_unique UNIQUE(business_id)
      )
    `);

    // ── Table: orders — add Siigo columns ────────────────────────────────────
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS siigo_invoice_id TEXT`);
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cufe TEXT`);

    // ── Enum: app_user_role ───────────────────────────────────────────────────
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE app_user_role AS ENUM ('admin', 'manager', 'staff', 'accountant');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── Table: app_users ──────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role app_user_role NOT NULL DEFAULT 'staff',
        display_name TEXT,
        employee_id UUID,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT app_users_business_username_unique UNIQUE(business_id, username)
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS app_users_business_id_idx ON app_users(business_id)
    `);

    // ── Column: employee_roles.color + permission_level ───────────────────────
    await db.execute(sql`ALTER TABLE employee_roles ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6366f1'`);
    await db.execute(sql`ALTER TABLE employee_roles ADD COLUMN IF NOT EXISTS permission_level TEXT DEFAULT 'staff'`);

    // ── Table: employee_default_shifts ────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS employee_default_shifts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        CONSTRAINT employee_default_shifts_day_unique UNIQUE(employee_id, day_of_week)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS employee_default_shifts_employee_id_idx ON employee_default_shifts(employee_id)
    `);

    console.log("[migrate] Startup migrations complete");
  } catch (err) {
    console.error("[migrate] Startup migration failed:", err);
    // Don't crash the server — log and continue. Most errors here mean
    // the migration already ran or a non-critical step failed.
  }
}
