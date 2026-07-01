import { Router } from "express";
import { db } from "@bizcore/db";
import { purchaseOrdersTable, purchaseOrderLinesTable } from "@bizcore/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { isLocationAllowed } from "../lib/access";
import { extractReceipt, isConfigured } from "../lib/receipt-extraction";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("purchasing")];
const canCapture = requireRole("owner", "admin", "manager");

const lineTotal = (qty: number, cost: number) => (Number.isFinite(qty * cost) ? qty * cost : 0).toFixed(2);

// Whether AI receipt capture is available (surface it so the UI can hide the button).
router.get("/purchases/capture/status", ...guard, canCapture, async (_req, res): Promise<void> => {
  res.json({ available: isConfigured() });
});

// Scan a receipt: AI-extract line items → a pending-review purchase.
router.post("/purchases/capture", ...guard, canCapture, async (req, res): Promise<void> => {
  const { businessId, userId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = z.object({
      locationId: z.string().uuid(),
      imageBase64: z.string().min(1),
      mediaType: z.string().regex(/^(image\/(jpeg|png|webp)|application\/pdf)$/),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }
    if (!isConfigured()) { res.status(503).json({ error: "AI capture isn't set up yet. You can still enter the purchase manually." }); return; }

    let extracted;
    try {
      extracted = await extractReceipt(body.data.imageBase64, body.data.mediaType);
    } catch {
      res.status(502).json({ error: "Couldn't read that receipt. Try a clearer photo, or enter it manually." });
      return;
    }

    const po = await db.transaction(async (tx) => {
      const [o] = await tx.insert(purchaseOrdersTable).values({
        businessId,
        locationId: body.data.locationId,
        status: "pending_review",
        source: "invoice_ai",
        taxId: extracted.taxId ?? null,
        createdBy: userId,
      }).returning();
      const lines = (extracted.lines ?? []).map((l) => ({
        purchaseOrderId: o!.id,
        description: l.description || "Item",
        quantity: String(l.quantity ?? 0),
        unitCost: String(l.unitCost ?? 0),
        lineTotal: lineTotal(l.quantity ?? 0, l.unitCost ?? 0),
      }));
      if (lines.length) await tx.insert(purchaseOrderLinesTable).values(lines);
      return o!;
    });

    const lines = await db.select().from(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.purchaseOrderId, po.id));
    res.status(201).json({ ...po, lines, extraction: extracted });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Start a blank manual purchase (no receipt) — also lands in pending review.
router.post("/purchases/draft", ...guard, canCapture, async (req, res): Promise<void> => {
  const { businessId, userId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = z.object({ locationId: z.string().uuid() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const [po] = await db.insert(purchaseOrdersTable).values({
      businessId,
      locationId: body.data.locationId,
      status: "pending_review",
      source: "manual",
      receiptMissing: true,
      createdBy: userId,
    }).returning();
    res.status(201).json({ ...po, lines: [] });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// The review queue — purchases awaiting approval.
router.get("/purchases/pending", ...guard, canCapture, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db.select().from(purchaseOrdersTable)
      .where(and(tenantWhere(purchaseOrdersTable.businessId, businessId), eq(purchaseOrdersTable.status, "pending_review")))
      .orderBy(desc(purchaseOrdersTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Approve a reviewed purchase — persists the corrected fields/lines and records it.
// "Approve = record the purchase"; receiving into stock stays a separate step.
const approveSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  taxId: z.string().nullable().optional(),
  expenseCategory: z.string().nullable().optional(),
  receiptMissing: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  lines: z.array(z.object({
    variantId: z.string().uuid().nullable().optional(),
    description: z.string().min(1),
    quantity: z.string(),
    unitId: z.string().uuid().nullable().optional(),
    unitCost: z.string(),
  })).min(1),
});

router.post("/purchases/:id/approve", ...guard, canCapture, async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const body = approveSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [po] = await db.select().from(purchaseOrdersTable).where(
      and(eq(purchaseOrdersTable.id, req.params["id"] as string), tenantWhere(purchaseOrdersTable.businessId, businessId))
    );
    if (!po) { res.status(404).json({ error: "Not found" }); return; }
    if (!["pending_review", "draft"].includes(po.status)) { res.status(409).json({ error: `This purchase is already ${po.status}.` }); return; }

    await db.transaction(async (tx) => {
      await tx.delete(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.purchaseOrderId, po.id));
      await tx.insert(purchaseOrderLinesTable).values(body.data.lines.map((l) => ({
        purchaseOrderId: po.id,
        variantId: l.variantId ?? null,
        description: l.description,
        quantity: l.quantity,
        unitId: l.unitId ?? null,
        unitCost: l.unitCost,
        lineTotal: lineTotal(parseFloat(l.quantity), parseFloat(l.unitCost)),
      })));
      await tx.update(purchaseOrdersTable).set({
        status: "submitted",
        supplierId: body.data.supplierId ?? po.supplierId,
        taxId: body.data.taxId ?? po.taxId,
        expenseCategory: body.data.expenseCategory ?? po.expenseCategory,
        receiptMissing: body.data.receiptMissing ?? po.receiptMissing,
        notes: body.data.notes ?? po.notes,
        approvedBy: userId,
        approvedAt: new Date(),
      }).where(eq(purchaseOrdersTable.id, po.id));
    });

    const [updated] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, po.id));
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
