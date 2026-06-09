import { db, unitsTable } from "./index";
import { sql } from "drizzle-orm";

const SYSTEM_UNITS = [
  // mass — base unit: gram (1.0)
  { name: "gram", abbreviation: "g", unitType: "mass" as const, conversionToBase: "1.0", isSystem: true },
  { name: "kilogram", abbreviation: "kg", unitType: "mass" as const, conversionToBase: "1000.0", isSystem: true },
  { name: "ounce", abbreviation: "oz", unitType: "mass" as const, conversionToBase: "28.34952", isSystem: true },
  { name: "pound", abbreviation: "lb", unitType: "mass" as const, conversionToBase: "453.59237", isSystem: true },

  // volume — base unit: milliliter (1.0)
  { name: "milliliter", abbreviation: "ml", unitType: "volume" as const, conversionToBase: "1.0", isSystem: true },
  { name: "liter", abbreviation: "L", unitType: "volume" as const, conversionToBase: "1000.0", isSystem: true },
  { name: "fluid ounce", abbreviation: "fl oz", unitType: "volume" as const, conversionToBase: "29.57353", isSystem: true },
  { name: "cup", abbreviation: "cup", unitType: "volume" as const, conversionToBase: "236.58824", isSystem: true },
  { name: "gallon", abbreviation: "gal", unitType: "volume" as const, conversionToBase: "3785.41178", isSystem: true },

  // count — base unit: each (1.0)
  { name: "each", abbreviation: "ea", unitType: "count" as const, conversionToBase: "1.0", isSystem: true },
  { name: "dozen", abbreviation: "doz", unitType: "count" as const, conversionToBase: "12.0", isSystem: true },
  { name: "case", abbreviation: "case", unitType: "count" as const, conversionToBase: "24.0", isSystem: true },

  // time — base unit: minute (1.0)
  { name: "minute", abbreviation: "min", unitType: "time" as const, conversionToBase: "1.0", isSystem: true },
  { name: "hour", abbreviation: "hr", unitType: "time" as const, conversionToBase: "60.0", isSystem: true },
];

async function seed() {
  console.log("Seeding system units...");

  for (const unit of SYSTEM_UNITS) {
    await db
      .insert(unitsTable)
      .values(unit)
      .onConflictDoNothing();
  }

  console.log(`Seeded ${SYSTEM_UNITS.length} system units.`);
  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
