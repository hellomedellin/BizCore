import { Router } from "express";
import { seedDemo } from "@bizcore/db/seed-demo";

const router = Router();

// TEMPORARY endpoint to load demo data into the business. Token-guarded and
// idempotent (skips if the business already has items). Remove once seeded.
const SEED_TOKEN = "demo-seed-7f3a9c2e1b8d4f60a5e9";

router.post("/admin/seed-demo", async (req, res): Promise<void> => {
  if (req.query["token"] !== SEED_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const result = await seedDemo();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Seed failed",
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
});

export default router;
