// Demo data seeder — populates an existing business with realistic, internally
// consistent sample data across every module so the app looks like a real
// coffee shop. Idempotent: if the target business already has items, it returns
// without changes (so it won't create duplicates on a second run).
//
// Exposed as a callable function so it can run inside the API process (where the
// database is reachable on Railway's private network). Targets the business
// owned by DEMO_OWNER_EMAIL; falls back to the most recently created business.

import { db } from "./index";
import {
  unitsTable, businessesTable, locationsTable, businessModulesTable, businessUsersTable, usersTable,
  categoriesTable, itemsTable, itemVariantsTable, inventoryTable, inventoryTransactionsTable,
  customersTable, suppliersTable, purchaseOrdersTable, purchaseOrderLinesTable,
  employeeRolesTable, employeesTable, employeeLocationsTable, shiftsTable, timeEntriesTable, timeOffRequestsTable,
  ordersTable, orderLinesTable, orderStatusHistoryTable,
  consumptionProfilesTable, consumptionProfileLinesTable,
} from "./index";
import { eq, desc, and } from "drizzle-orm";

const OWNER_EMAIL = process.env["DEMO_OWNER_EMAIL"] ?? "ikamand@hellomedellin.com";

const DAY = 86_400_000;
const money = (n: number) => n.toFixed(2);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const randInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const fmtDate = (d: Date): string => d.toISOString().slice(0, 10);

const SYSTEM_UNITS = [
  { name: "gram", abbreviation: "g", unitType: "mass" as const, conversionToBase: "1.0", isSystem: true },
  { name: "kilogram", abbreviation: "kg", unitType: "mass" as const, conversionToBase: "1000.0", isSystem: true },
  { name: "ounce", abbreviation: "oz", unitType: "mass" as const, conversionToBase: "28.34952", isSystem: true },
  { name: "pound", abbreviation: "lb", unitType: "mass" as const, conversionToBase: "453.59237", isSystem: true },
  { name: "milliliter", abbreviation: "ml", unitType: "volume" as const, conversionToBase: "1.0", isSystem: true },
  { name: "liter", abbreviation: "L", unitType: "volume" as const, conversionToBase: "1000.0", isSystem: true },
  { name: "fluid ounce", abbreviation: "fl oz", unitType: "volume" as const, conversionToBase: "29.57353", isSystem: true },
  { name: "gallon", abbreviation: "gal", unitType: "volume" as const, conversionToBase: "3785.41178", isSystem: true },
  { name: "each", abbreviation: "ea", unitType: "count" as const, conversionToBase: "1.0", isSystem: true },
  { name: "dozen", abbreviation: "doz", unitType: "count" as const, conversionToBase: "12.0", isSystem: true },
  { name: "case", abbreviation: "case", unitType: "count" as const, conversionToBase: "24.0", isSystem: true },
  { name: "minute", abbreviation: "min", unitType: "time" as const, conversionToBase: "1.0", isSystem: true },
  { name: "hour", abbreviation: "hr", unitType: "time" as const, conversionToBase: "60.0", isSystem: true },
];

const ALL_MODULES = [
  "inventory", "consumption_profiles", "orders", "customers", "employees",
  "time_tracking", "scheduling", "purchasing", "invoice_ai", "reporting", "api_access",
] as const;

export async function seedDemo(): Promise<Record<string, unknown>> {
  const now = Date.now();
  const ago = (days: number, jitterMs = 0) => new Date(now - days * DAY - jitterMs);
  const ahead = (days: number) => new Date(now + days * DAY);

  // Everything runs in one transaction: if any insert fails, the whole seed
  // rolls back so there is never partial demo data to clean up.
  return db.transaction(async (tx) => {
  // ── find the target business ──────────────────────────────────────────────
  let businessId: string | null = null;
  const [owner] = await tx.select().from(usersTable).where(eq(usersTable.email, OWNER_EMAIL)).limit(1);
  if (owner) {
    const [bu] = await tx.select().from(businessUsersTable).where(eq(businessUsersTable.userId, owner.id)).orderBy(desc(businessUsersTable.createdAt)).limit(1);
    if (bu) businessId = bu.businessId;
  }
  if (!businessId) {
    const [biz] = await tx.select().from(businessesTable).orderBy(desc(businessesTable.createdAt)).limit(1);
    businessId = biz?.id ?? null;
  }
  if (!businessId) throw new Error("No business found. Sign up and complete onboarding first, then re-run.");
  const [business] = await tx.select().from(businessesTable).where(eq(businessesTable.id, businessId));
  const createdBy = business!.ownerUserId;

  // ── enable every module so all features are visible ─────────────────────────
  for (const m of ALL_MODULES) {
    await tx.insert(businessModulesTable).values({ businessId, module: m, enabled: true })
      .onConflictDoUpdate({ target: [businessModulesTable.businessId, businessModulesTable.module], set: { enabled: true } });
  }

  // ── location ────────────────────────────────────────────────────────────────
  let [location] = await tx.select().from(locationsTable).where(eq(locationsTable.businessId, businessId)).limit(1);
  if (!location) {
    [location] = await tx.insert(locationsTable).values({ businessId, name: "Main Cafe", type: "restaurant", address: "120 Market St", phone: "(555) 200-1000" }).returning();
  }
  const locationId = location!.id;

  // ── idempotency guard ─────────────────────────────────────────────────────────
  const [existing] = await tx.select().from(itemsTable).where(eq(itemsTable.businessId, businessId)).limit(1);
  if (existing) {
    return { skipped: true, business: business!.name, message: "Business already has items — skipped to avoid duplicate demo data. (All modules were (re)enabled.)" };
  }

  // ── system units (only if not already present) ───────────────────────────────
  const haveUnits = await tx.select().from(unitsTable).limit(1);
  if (haveUnits.length === 0) {
    for (const u of SYSTEM_UNITS) await tx.insert(unitsTable).values(u).onConflictDoNothing();
  }
  const units = await tx.select().from(unitsTable);
  const unitId = (abbr: string) => units.find((u) => u.abbreviation === abbr)?.id ?? null;

  // ── categories ────────────────────────────────────────────────────────────────
  const cats = await tx.insert(categoriesTable).values([
    { businessId, name: "Coffee", sortOrder: "1" },
    { businessId, name: "Tea", sortOrder: "2" },
    { businessId, name: "Pastries", sortOrder: "3" },
    { businessId, name: "Retail", sortOrder: "4" },
    { businessId, name: "Ingredients", sortOrder: "5" },
  ]).returning();
  const catId = (name: string) => cats.find((c) => c.name === name)!.id;

  // ── items + variants ──────────────────────────────────────────────────────────
  type VariantDef = { name: string; price?: string; cost?: string; sku?: string };
  type ItemDef = { key: string; name: string; type: "product" | "resource" | "service"; category: string; description?: string; trackInventory?: boolean; variants: VariantDef[] };
  const itemDefs: ItemDef[] = [
    { key: "latte", name: "Latte", type: "product", category: "Coffee", description: "Espresso with steamed milk", variants: [ { name: "Small", price: "4.25", cost: "1.10", sku: "LAT-S" }, { name: "Medium", price: "4.75", cost: "1.25", sku: "LAT-M" }, { name: "Large", price: "5.25", cost: "1.40", sku: "LAT-L" } ] },
    { key: "cappuccino", name: "Cappuccino", type: "product", category: "Coffee", description: "Espresso, steamed milk, thick foam", variants: [ { name: "Medium", price: "4.50", cost: "1.20", sku: "CAP-M" } ] },
    { key: "espresso", name: "Espresso", type: "product", category: "Coffee", description: "A concentrated shot", variants: [ { name: "Single", price: "3.00", cost: "0.65", sku: "ESP-1" }, { name: "Double", price: "3.75", cost: "0.95", sku: "ESP-2" } ] },
    { key: "coldbrew", name: "Cold Brew", type: "product", category: "Coffee", description: "Slow-steeped 18 hours", variants: [ { name: "Medium", price: "4.50", cost: "1.05", sku: "CB-M" }, { name: "Large", price: "5.25", cost: "1.30", sku: "CB-L" } ] },
    { key: "drip", name: "Drip Coffee", type: "product", category: "Coffee", description: "House blend, brewed fresh", variants: [ { name: "Small", price: "2.75", cost: "0.45", sku: "DRP-S" }, { name: "Medium", price: "3.25", cost: "0.55", sku: "DRP-M" }, { name: "Large", price: "3.75", cost: "0.65", sku: "DRP-L" } ] },
    { key: "chai", name: "Chai Latte", type: "product", category: "Tea", description: "Spiced black tea with steamed milk", variants: [ { name: "Medium", price: "4.75", cost: "1.15", sku: "CHA-M" } ] },
    { key: "greentea", name: "Green Tea", type: "product", category: "Tea", description: "Loose-leaf sencha", variants: [ { name: "Medium", price: "3.50", cost: "0.60", sku: "GTE-M" } ] },
    { key: "croissant", name: "Butter Croissant", type: "product", category: "Pastries", description: "Baked fresh daily", variants: [ { name: "Each", price: "3.75", cost: "1.30", sku: "CRO-1" } ] },
    { key: "muffin", name: "Blueberry Muffin", type: "product", category: "Pastries", description: "Loaded with blueberries", variants: [ { name: "Each", price: "3.50", cost: "1.10", sku: "MUF-1" } ] },
    { key: "toast", name: "Avocado Toast", type: "product", category: "Pastries", description: "Sourdough, smashed avocado, chili flakes", variants: [ { name: "Each", price: "8.50", cost: "2.75", sku: "AVT-1" } ] },
    { key: "beansbag", name: "House Blend (Retail Bag)", type: "product", category: "Retail", description: "Take our beans home", variants: [ { name: "250g", price: "14.00", cost: "5.50", sku: "BAG-250" }, { name: "1kg", price: "42.00", cost: "18.00", sku: "BAG-1000" } ] },
    { key: "beans", name: "Coffee Beans — House Blend", type: "resource", category: "Ingredients", description: "Whole bean, 1kg bag", trackInventory: true, variants: [ { name: "1kg Bag", cost: "18.00", sku: "RES-BEANS" } ] },
    { key: "milk", name: "Whole Milk", type: "resource", category: "Ingredients", description: "Gallon jug", trackInventory: true, variants: [ { name: "1 Gallon", cost: "4.50", sku: "RES-MILK" } ] },
    { key: "oatmilk", name: "Oat Milk", type: "resource", category: "Ingredients", description: "Barista edition, 1L", trackInventory: true, variants: [ { name: "1 Liter", cost: "3.20", sku: "RES-OAT" } ] },
    { key: "cups12", name: "Paper Cups 12oz", type: "resource", category: "Ingredients", description: "Sleeve of 1000", trackInventory: true, variants: [ { name: "Each", cost: "0.12", sku: "RES-CUP12" } ] },
    { key: "cups16", name: "Paper Cups 16oz", type: "resource", category: "Ingredients", description: "Sleeve of 1000", trackInventory: true, variants: [ { name: "Each", cost: "0.14", sku: "RES-CUP16" } ] },
  ];

  const V: Record<string, { id: string; price: string | null; name: string; itemName: string }> = {};
  const sellable: { id: string; price: string; name: string }[] = [];
  for (const def of itemDefs) {
    const [item] = await tx.insert(itemsTable).values({
      businessId, name: def.name, description: def.description ?? null, type: def.type, categoryId: catId(def.category),
      basePrice: def.variants[0]?.price ?? null, cost: def.variants[0]?.cost ?? null,
      trackInventory: def.trackInventory ?? def.type === "resource", hasVariants: def.variants.length > 1,
    }).returning();
    for (const vd of def.variants) {
      const [variant] = await tx.insert(itemVariantsTable).values({ itemId: item!.id, name: vd.name, sku: vd.sku ?? null, price: vd.price ?? null, cost: vd.cost ?? null }).returning();
      const vkey = def.variants.length > 1 ? `${def.key}:${vd.name}` : def.key;
      V[vkey] = { id: variant!.id, price: vd.price ?? null, name: vd.name, itemName: def.name };
      if (def.type === "product" && vd.price) sellable.push({ id: variant!.id, price: vd.price, name: `${def.name} (${vd.name})` });
    }
  }

  // ── inventory + opening-stock transactions ───────────────────────────────────
  const stock = [
    { vkey: "beans", qty: 24, unit: "kg", low: 8 }, { vkey: "milk", qty: 18, unit: "gal", low: 6 },
    { vkey: "oatmilk", qty: 22, unit: "L", low: 8 }, { vkey: "cups12", qty: 2400, unit: "ea", low: 500 },
    { vkey: "cups16", qty: 1800, unit: "ea", low: 500 }, { vkey: "beansbag:250g", qty: 40, unit: "ea", low: 10 },
    { vkey: "beansbag:1kg", qty: 12, unit: "ea", low: 4 },
  ];
  for (const s of stock) {
    const v = V[s.vkey];
    if (!v) continue;
    await tx.insert(inventoryTable).values({ variantId: v.id, locationId, quantity: money(s.qty), unitId: unitId(s.unit), lowStockThreshold: money(s.low) }).onConflictDoNothing();
    await tx.insert(inventoryTransactionsTable).values({ variantId: v.id, locationId, type: "receive", quantityChange: money(s.qty), unitId: unitId(s.unit), notes: "Opening stock", createdBy, createdAt: ago(20) });
  }

  // ── customers ─────────────────────────────────────────────────────────────────
  const customers = await tx.insert(customersTable).values([
    { businessId, name: "Sarah Mitchell", phone: "(555) 318-2204", email: "sarah.mitchell@gmail.com", notes: "Regular — oat milk latte" },
    { businessId, name: "James Carter", phone: "(555) 776-9012", email: "jcarter@outlook.com", notes: "Mobile orders, picks up 8am" },
    { businessId, name: "Priya Nair", phone: "(555) 442-1187", email: "priya.nair@gmail.com" },
    { businessId, name: "Diego Ramirez", phone: "(555) 901-3345", email: "diego.r@yahoo.com", notes: "Catering for nearby office" },
    { businessId, name: "Emily Chen", phone: "(555) 223-7788", email: "emily.chen@gmail.com" },
    { businessId, name: "Marcus Johnson", phone: "(555) 660-4421", email: "mjohnson@gmail.com" },
    { businessId, name: "Olivia Brooks", phone: "(555) 837-1290", email: "olivia.brooks@hotmail.com", notes: "Allergic to nuts" },
    { businessId, name: "Tom Becker", phone: "(555) 514-6677", email: "tbecker@gmail.com" },
  ]).returning();

  // ── suppliers + purchase orders ───────────────────────────────────────────────
  const suppliers = await tx.insert(suppliersTable).values([
    { businessId, name: "Roast Republic", contactName: "Dana Lee", phone: "(555) 700-1212", email: "orders@roastrepublic.com", address: "88 Industrial Way", notes: "House blend roaster — net 15" },
    { businessId, name: "Valley Dairy Co.", contactName: "Hank Powell", phone: "(555) 700-3434", email: "sales@valleydairy.com", address: "12 Farm Rd" },
    { businessId, name: "GreenLeaf Oat & Alt", contactName: "Mia Tran", phone: "(555) 700-5656", email: "hello@greenleaf.co" },
    { businessId, name: "PackRight Supplies", contactName: "Carl Estes", phone: "(555) 700-7878", email: "cs@packright.com", notes: "Cups, lids, napkins" },
  ]).returning();
  const supId = (name: string) => suppliers.find((s) => s.name === name)!.id;

  const poDefs = [
    { supplier: "Roast Republic", status: "received" as const, daysAgo: 18, lines: [ { vkey: "beans", desc: "House Blend — 1kg bags", qty: 20, unit: "kg", cost: 18 } ] },
    { supplier: "Valley Dairy Co.", status: "received" as const, daysAgo: 6, lines: [ { vkey: "milk", desc: "Whole milk — gallon", qty: 18, unit: "gal", cost: 4.5 } ] },
    { supplier: "PackRight Supplies", status: "received" as const, daysAgo: 11, lines: [ { vkey: "cups12", desc: "12oz paper cups", qty: 2000, unit: "ea", cost: 0.12 }, { vkey: "cups16", desc: "16oz paper cups", qty: 1500, unit: "ea", cost: 0.14 } ] },
    { supplier: "GreenLeaf Oat & Alt", status: "submitted" as const, daysAgo: 2, lines: [ { vkey: "oatmilk", desc: "Barista oat milk — 1L", qty: 24, unit: "L", cost: 3.2 } ] },
    { supplier: "Roast Republic", status: "draft" as const, daysAgo: 0, lines: [ { vkey: "beans", desc: "House Blend — 1kg bags", qty: 24, unit: "kg", cost: 18 } ] },
  ];
  for (const po of poDefs) {
    const received = po.status === "received";
    const [order] = await tx.insert(purchaseOrdersTable).values({
      businessId, locationId, supplierId: supId(po.supplier), status: po.status, source: "manual",
      notes: received ? "Delivered and stocked" : po.status === "submitted" ? "Awaiting delivery" : "Draft — review before sending",
      expectedAt: received ? ago(po.daysAgo - 2) : ahead(3), receivedAt: received ? ago(po.daysAgo) : null, createdBy, createdAt: ago(po.daysAgo),
    }).returning();
    for (const l of po.lines) {
      await tx.insert(purchaseOrderLinesTable).values({ purchaseOrderId: order!.id, variantId: V[l.vkey]?.id ?? null, description: l.desc, quantity: money(l.qty), unitId: unitId(l.unit), unitCost: l.cost.toFixed(4), lineTotal: money(l.qty * l.cost), matched: received });
    }
  }

  // ── employee roles + employees + shifts + time entries + time off ─────────────
  const roles = await tx.insert(employeeRolesTable).values([
    { businessId, name: "Barista", hourlyRateDefault: "16.00" }, { businessId, name: "Shift Lead", hourlyRateDefault: "19.50" },
    { businessId, name: "Baker", hourlyRateDefault: "20.00" }, { businessId, name: "Manager", hourlyRateDefault: "26.00" },
  ]).returning();
  const roleId = (name: string) => roles.find((r) => r.name === name)!.id;

  const empDefs = [
    { name: "Ava Thompson", role: "Manager", rate: "27.00", email: "ava.thompson@demo.co", phone: "(555) 480-1001" },
    { name: "Liam Nguyen", role: "Shift Lead", rate: "20.00", email: "liam.nguyen@demo.co", phone: "(555) 480-1002" },
    { name: "Sofia Garcia", role: "Barista", rate: "16.50", email: "sofia.garcia@demo.co", phone: "(555) 480-1003" },
    { name: "Noah Patel", role: "Barista", rate: "16.00", email: "noah.patel@demo.co", phone: "(555) 480-1004" },
    { name: "Maya Robinson", role: "Barista", rate: "16.00", email: "maya.robinson@demo.co", phone: "(555) 480-1005" },
    { name: "Ethan Brooks", role: "Baker", rate: "20.50", email: "ethan.brooks@demo.co", phone: "(555) 480-1006" },
  ];
  const employees: { id: string; rate: string }[] = [];
  for (const e of empDefs) {
    const [emp] = await tx.insert(employeesTable).values({ businessId, name: e.name, email: e.email, phone: e.phone, roleId: roleId(e.role), primaryLocationId: locationId, hourlyRate: e.rate, overtimeRateMultiplier: "1.50" }).returning();
    await tx.insert(employeeLocationsTable).values({ employeeId: emp!.id, locationId }).onConflictDoNothing();
    employees.push({ id: emp!.id, rate: e.rate });
  }

  for (let d = 0; d < 7; d++) {
    const day = ahead(d);
    for (const emp of [pick(employees), pick(employees)]) {
      const start = new Date(day); start.setHours(6, 0, 0, 0);
      const end = new Date(day); end.setHours(14, 0, 0, 0);
      await tx.insert(shiftsTable).values({ employeeId: emp.id, locationId, startTime: start, endTime: end, notes: "Open" });
    }
    const closer = pick(employees);
    const cs = new Date(day); cs.setHours(13, 0, 0, 0);
    const ce = new Date(day); ce.setHours(20, 0, 0, 0);
    await tx.insert(shiftsTable).values({ employeeId: closer.id, locationId, startTime: cs, endTime: ce, notes: "Close" });
  }

  for (let d = 1; d <= 14; d++) {
    const day = ago(d);
    if (day.getDay() === 0) continue;
    for (const emp of employees.slice(0, 4)) {
      const clockIn = new Date(day); clockIn.setHours(randInt(6, 8), randInt(0, 59), 0, 0);
      const clockOut = new Date(clockIn.getTime() + (7.5 + Math.random()) * 3600_000);
      const total = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000) - 30;
      await tx.insert(timeEntriesTable).values({ employeeId: emp.id, locationId, entryType: "regular", clockIn, clockOut, breakMinutes: 30, totalMinutes: total, hourlyRateSnapshot: emp.rate, overtimeRateSnapshot: "1.50", status: "approved", approvedBy: createdBy, approvedAt: new Date(clockOut.getTime() + 3600_000) });
    }
  }

  await tx.insert(timeOffRequestsTable).values([
    { employeeId: employees[2]!.id, requestType: "vacation", startDate: fmtDate(ahead(12)), endDate: fmtDate(ahead(16)), notes: "Family trip", status: "approved", reviewedBy: createdBy, reviewedAt: ago(3) },
    { employeeId: employees[3]!.id, requestType: "sick", startDate: fmtDate(ago(2)), endDate: fmtDate(ago(2)), notes: "Flu", status: "approved", reviewedBy: createdBy, reviewedAt: ago(2) },
    { employeeId: employees[4]!.id, requestType: "personal", startDate: fmtDate(ahead(5)), endDate: fmtDate(ahead(5)), notes: "Appointment", status: "pending" },
  ]);

  // ── consumption profiles (recipes) ────────────────────────────────────────────
  const profiles = [
    { output: "latte:Medium", name: "Medium Latte", resources: [ { vkey: "beans", qty: 18, unit: "g" }, { vkey: "milk", qty: 220, unit: "ml" } ], laborMin: 2, laborRole: "Barista" },
    { output: "cappuccino", name: "Cappuccino", resources: [ { vkey: "beans", qty: 18, unit: "g" }, { vkey: "milk", qty: 150, unit: "ml" } ], laborMin: 2, laborRole: "Barista" },
    { output: "drip:Medium", name: "Medium Drip", resources: [ { vkey: "beans", qty: 14, unit: "g" } ], laborMin: 1, laborRole: "Barista" },
  ];
  for (const p of profiles) {
    const out = V[p.output];
    if (!out) continue;
    const [variantRow] = await tx.select().from(itemVariantsTable).where(eq(itemVariantsTable.id, out.id));
    const [profile] = await tx.insert(consumptionProfilesTable).values({ businessId, outputItemId: (variantRow as { itemId: string }).itemId, outputVariantId: out.id, name: p.name }).returning();
    for (const r of p.resources) {
      await tx.insert(consumptionProfileLinesTable).values({ profileId: profile!.id, lineType: "resource", resourceVariantId: V[r.vkey]?.id ?? null, quantity: r.qty.toFixed(4), unitId: unitId(r.unit) });
    }
    await tx.insert(consumptionProfileLinesTable).values({ profileId: profile!.id, lineType: "labor", roleId: roleId(p.laborRole), laborMinutes: p.laborMin.toFixed(2) });
  }

  // ── orders over the last 30 days ──────────────────────────────────────────────
  const orderTypes = ["dine_in", "pickup", "delivery", "retail"] as const;
  let orderCount = 0;
  for (let i = 0; i < 36; i++) {
    const daysAgo = randInt(0, 30);
    const createdAt = ago(daysAgo, randInt(0, 12) * 3600_000 + randInt(0, 59) * 60000);
    const lines: { variantId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }[] = [];
    for (let l = 0; l < randInt(1, 4); l++) {
      const v = pick(sellable);
      const qty = randInt(1, 3);
      const unitPrice = parseFloat(v.price);
      lines.push({ variantId: v.id, name: v.name, quantity: qty, unitPrice, lineTotal: qty * unitPrice });
    }
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const discount = Math.random() < 0.15 ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
    const tax = Math.round((subtotal - discount) * 0.08 * 100) / 100;
    const total = subtotal - discount + tax;
    const status = daysAgo >= 1 ? (Math.random() < 0.95 ? "completed" : "cancelled") : pick(["pending", "confirmed", "in_progress", "ready", "completed"] as const);
    const [order] = await tx.insert(ordersTable).values({
      businessId, locationId, customerId: Math.random() < 0.6 ? pick(customers).id : null, orderType: pick(orderTypes), status, source: "internal",
      subtotal: money(subtotal), discount: money(discount), tax: money(tax), total: money(total), currencyCode: business!.currencyCode,
      completedAt: status === "completed" ? createdAt : null, createdBy, createdAt,
    }).returning();
    for (const l of lines) {
      await tx.insert(orderLinesTable).values({ orderId: order!.id, variantId: l.variantId, name: l.name, quantity: money(l.quantity), unitPrice: money(l.unitPrice), lineTotal: money(l.lineTotal) });
    }
    await tx.insert(orderStatusHistoryTable).values({ orderId: order!.id, toStatus: status, changedBy: createdBy, changedAt: createdAt });
    orderCount++;
  }

  return {
    ok: true, business: business!.name, modulesEnabled: ALL_MODULES.length, items: itemDefs.length,
    stockedVariants: stock.length, customers: customers.length, suppliers: suppliers.length,
    purchaseOrders: poDefs.length, employees: employees.length, recipes: profiles.length, orders: orderCount,
  };
  });
}

// Removes businesses that have no real data (no items, orders, customers, or
// employees) — i.e. leftovers from abandoned onboarding attempts. Deleting a
// business cascades its locations, members, and module settings. Pass
// confirm=false for a dry run that only reports what would be deleted.
export async function cleanupEmptyBusinesses(confirm: boolean): Promise<Record<string, unknown>> {
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.email, OWNER_EMAIL)).limit(1);
  const allBiz = await db.select().from(businessesTable);

  const report: { id: string; name: string; linkedToOwner: boolean; hasItems: boolean; hasOrders: boolean; empty: boolean }[] = [];
  for (const biz of allBiz) {
    const [it] = await db.select().from(itemsTable).where(eq(itemsTable.businessId, biz.id)).limit(1);
    const [ord] = await db.select().from(ordersTable).where(eq(ordersTable.businessId, biz.id)).limit(1);
    const [cust] = await db.select().from(customersTable).where(eq(customersTable.businessId, biz.id)).limit(1);
    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.businessId, biz.id)).limit(1);
    let linked = false;
    if (owner) {
      const [l] = await db.select().from(businessUsersTable).where(and(eq(businessUsersTable.businessId, biz.id), eq(businessUsersTable.userId, owner.id))).limit(1);
      linked = !!l;
    }
    report.push({ id: biz.id, name: biz.name, linkedToOwner: linked, hasItems: !!it, hasOrders: !!ord, empty: !it && !ord && !cust && !emp });
  }

  const deleted: string[] = [];
  if (confirm) {
    await db.transaction(async (tx) => {
      for (const r of report) {
        if (r.empty) {
          await tx.delete(businessesTable).where(eq(businessesTable.id, r.id));
          deleted.push(r.name);
        }
      }
    });
  }

  return { ownerEmail: OWNER_EMAIL, ownerFound: !!owner, totalBusinesses: allBiz.length, mode: confirm ? "deleted" : "dry-run", businesses: report, deleted };
}
