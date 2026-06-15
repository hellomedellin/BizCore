import { Router } from "express";
import { cleanupEmptyBusinesses } from "@bizcore/db/seed-demo";

const router = Router();

// TEMPORARY token-guarded maintenance endpoint. Remove after use.
const SEED_TOKEN = "demo-seed-7f3a9c2e1b8d4f60a5e9";

// Dry run by default; pass ?confirm=true to actually delete empty businesses.
router.post("/admin/cleanup-businesses", async (req, res): Promise<void> => {
  if (req.query["token"] !== SEED_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    const result = await cleanupEmptyBusinesses(req.query["confirm"] === "true");
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Cleanup failed",
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
});

export default router;
