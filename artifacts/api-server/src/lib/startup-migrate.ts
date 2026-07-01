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
        CREATE TYPE app_user_role AS ENUM ('owner', 'admin', 'manager', 'staff', 'accountant');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    // Add owner value to existing enum if not present
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TYPE app_user_role ADD VALUE IF NOT EXISTS 'owner' BEFORE 'admin';
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // Auto-promote: if no owner exists, make the oldest admin the owner
    await db.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM app_users WHERE role = 'owner' LIMIT 1) THEN
          UPDATE app_users SET role = 'owner'
          WHERE id = (SELECT id FROM app_users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1);
        END IF;
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

    // ── Enums: payment_method, payment_status, payment_pos_source ────────────
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('cash','card','transfer','nequi','daviplata','other');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('completed','refunded');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE payment_pos_source AS ENUM ('manual','pos_sync','siigo_sync');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── Table: payments ───────────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        business_id UUID NOT NULL,
        location_id UUID,
        amount NUMERIC(10,2) NOT NULL,
        tip NUMERIC(10,2) NOT NULL DEFAULT 0,
        currency_code TEXT NOT NULL DEFAULT 'USD',
        method payment_method NOT NULL,
        status payment_status NOT NULL DEFAULT 'completed',
        external_transaction_id TEXT,
        pos_source payment_pos_source NOT NULL DEFAULT 'manual',
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS payments_order_id_idx ON payments(order_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS payments_business_id_idx ON payments(business_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS payments_business_created_at_idx ON payments(business_id, created_at)`);

    // ── Table: pos_connections ────────────────────────────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pos_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        api_key TEXT,
        last_sync_at TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT pos_connections_business_id_unique UNIQUE(business_id)
      )
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

    // ── Column: item_variants.is_available (the "86" / sold-out flag) ─────────
    await db.execute(sql`ALTER TABLE item_variants ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT true`);

    // ── Column: item_variants.unit_id (unit of measure for the variant) ───────
    await db.execute(sql`ALTER TABLE item_variants ADD COLUMN IF NOT EXISTS unit_id UUID`);

    // ── Purchase capture: pending_review status + capture/accounting columns ──
    await db.execute(sql`ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'pending_review' BEFORE 'submitted'`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tax_id TEXT`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expense_category TEXT`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS receipt_missing BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_by TEXT`);
    await db.execute(sql`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`);

    // ── Table: cash_reconciliations (end-of-shift cash counts) ────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cash_reconciliations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        location_id UUID NOT NULL,
        opened_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expected_cash NUMERIC(12,2) NOT NULL,
        counted_cash NUMERIC(12,2) NOT NULL,
        variance NUMERIC(12,2) NOT NULL,
        denominations TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS cash_recon_business_location_idx ON cash_reconciliations(business_id, location_id)
    `);

    console.log("[migrate] Startup migrations complete");
  } catch (err) {
    console.error("[migrate] Startup migration failed:", err);
    // Don't crash the server — log and continue. Most errors here mean
    // the migration already ran or a non-critical step failed.
  }
}
