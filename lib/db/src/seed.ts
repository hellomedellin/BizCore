/**
 * Seed script — creates demo business, locations, employees, and role-based users
 * for development and testing.
 *
 * Usage: pnpm --filter @workspace/db run seed
 *
 * Note: This script uses placeholder Clerk user IDs (prefixed with "seed_") since
 * actual Clerk user IDs are generated at sign-up time. In a live environment,
 * replace these with real Clerk user IDs from your Clerk dashboard.
 */

import { db } from "./index";
import {
  businessesTable,
  locationsTable,
  businessModulesTable,
  businessUsersTable,
  employeesTable,
  employeeRolesTable,
} from "./schema";
import { eq } from "drizzle-orm";

const SEED_OWNER_USER_ID = "seed_owner_user_demo_001";
const SEED_MANAGER_USER_ID = "seed_manager_user_demo_001";
const SEED_CASHIER_USER_ID = "seed_cashier_user_demo_001";
const SEED_HR_USER_ID = "seed_hr_user_demo_001";

const ALL_MODULES = [
  "inventory",
  "orders",
  "employees",
  "scheduling",
  "time_tracking",
  "reports",
  "payroll_future",
  "recipes_future",
];

async function seed() {
  console.log("Seeding database...");

  // Check if demo business already exists
  const existing = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.ownerUserId, SEED_OWNER_USER_ID))
    .limit(1);

  if (existing.length > 0) {
    console.log("Demo business already exists. Skipping seed.");
    process.exit(0);
  }

  // Create demo business
  const [business] = await db
    .insert(businessesTable)
    .values({
      name: "BizCore Demo Bistro",
      ownerUserId: SEED_OWNER_USER_ID,
      industry: "restaurant",
      email: "demo@bizcore.io",
      phone: "+1 (555) 000-0001",
      address: "123 Main Street, San Francisco, CA 94105",
    })
    .returning();

  console.log(`Created business: ${business.name} (id=${business.id})`);

  // Create locations
  const [mainLocation] = await db
    .insert(locationsTable)
    .values({
      businessId: business.id,
      name: "Downtown SF",
      type: "restaurant",
      address: "123 Main Street, San Francisco, CA 94105",
      phone: "+1 (555) 000-0002",
      active: true,
    })
    .returning();

  const [secondLocation] = await db
    .insert(locationsTable)
    .values({
      businessId: business.id,
      name: "Mission District",
      type: "restaurant",
      address: "456 Valencia Street, San Francisco, CA 94110",
      phone: "+1 (555) 000-0003",
      active: true,
    })
    .returning();

  console.log(`Created locations: ${mainLocation.name}, ${secondLocation.name}`);

  // Enable all modules for demo business
  await db.insert(businessModulesTable).values(
    ALL_MODULES.map((module) => ({
      businessId: business.id,
      module,
      enabled: true,
    })),
  );
  console.log("Enabled all modules");

  // Create employee roles
  const [serverRole] = await db
    .insert(employeeRolesTable)
    .values({ businessId: business.id, name: "Server" })
    .returning();

  const [kitchenRole] = await db
    .insert(employeeRolesTable)
    .values({ businessId: business.id, name: "Kitchen Staff" })
    .returning();

  const [managerRole] = await db
    .insert(employeeRolesTable)
    .values({ businessId: business.id, name: "Manager" })
    .returning();

  console.log("Created employee roles");

  // Create demo employees
  await db.insert(employeesTable).values([
    {
      businessId: business.id,
      name: "Sarah Chen",
      email: "sarah@bizcore-demo.io",
      phone: "+1 (555) 100-0001",
      roleId: managerRole.id,
      locationId: mainLocation.id,
      hourlyRate: "25.00",
      active: true,
    },
    {
      businessId: business.id,
      name: "Marcus Williams",
      email: "marcus@bizcore-demo.io",
      phone: "+1 (555) 100-0002",
      roleId: serverRole.id,
      locationId: mainLocation.id,
      hourlyRate: "16.50",
      active: true,
    },
    {
      businessId: business.id,
      name: "Priya Patel",
      email: "priya@bizcore-demo.io",
      phone: "+1 (555) 100-0003",
      roleId: kitchenRole.id,
      locationId: mainLocation.id,
      hourlyRate: "18.00",
      active: true,
    },
    {
      businessId: business.id,
      name: "Jordan Lee",
      email: "jordan@bizcore-demo.io",
      phone: "+1 (555) 100-0004",
      roleId: serverRole.id,
      locationId: secondLocation.id,
      hourlyRate: "16.50",
      active: true,
    },
    {
      businessId: business.id,
      name: "Emily Torres",
      email: "emily@bizcore-demo.io",
      phone: "+1 (555) 100-0005",
      roleId: kitchenRole.id,
      locationId: secondLocation.id,
      hourlyRate: "18.00",
      active: false,
    },
  ]);
  console.log("Created 5 demo employees (4 active, 1 inactive)");

  // Assign role-based users to the business
  // In production, replace these user IDs with real Clerk user IDs
  await db.insert(businessUsersTable).values([
    {
      businessId: business.id,
      userId: SEED_MANAGER_USER_ID,
      role: "manager",
      locationId: mainLocation.id,
      active: true,
    },
    {
      businessId: business.id,
      userId: SEED_CASHIER_USER_ID,
      role: "cashier",
      locationId: mainLocation.id,
      active: true,
    },
    {
      businessId: business.id,
      userId: SEED_HR_USER_ID,
      role: "hr",
      locationId: null,
      active: true,
    },
  ]);

  console.log("Created business users:");
  console.log(`  - Owner:   ${SEED_OWNER_USER_ID} (role: admin)`);
  console.log(`  - Manager: ${SEED_MANAGER_USER_ID} (role: manager)`);
  console.log(`  - Cashier: ${SEED_CASHIER_USER_ID} (role: cashier)`);
  console.log(`  - HR:      ${SEED_HR_USER_ID} (role: hr)`);

  console.log("\nSeed complete!");
  console.log(`Business ID: ${business.id}`);
  console.log(`Main location ID: ${mainLocation.id}`);
  console.log(`Second location ID: ${secondLocation.id}`);
  console.log("\nNote: Replace seed_*_user_demo_* IDs with real Clerk user IDs from your dashboard.");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
