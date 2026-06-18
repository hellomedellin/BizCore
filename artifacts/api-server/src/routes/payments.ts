import { Router } from "express";
import { db } from "@bizcore/db";
import {
  ordersTable,
  paymentsTable,
  posConnectionsTable,
} from "@bizcore/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { completeOrderInTx } from "../lib/order-completion";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("orders")];

// ─── POST /payments ──────────────────────────────────────────────────────────
// Record a payment and atomically complete the order (deducting inventory).

const createPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "amount must be a decimal string"),
  tip: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().default("0"),
  method: z.enum(["cash", "card", "transfer", "nequi", "daviplata", "other"]),
  notes: z.string().optional(),
  processedAt: z.string().datetime().optional(),
});

router.post("/payments", ...guard, async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const body = createPaymentSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    // Fetch and validate the order.
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, body.data.orderId), tenantWhere(ordersTable.businessId, businessId)))
      .limit(1);

    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status === "cancelled") { res.status(409).json({ error: "Cannot pay a cancelled order" }); return; }
    if (order.status === "completed") { res.status(409).json({ error: "Order is already completed" }); return; }

    // Amount must cover the order total (tip is on top).
    const amountCents = Math.round(parseFloat(body.data.amount) * 100);
    const totalCents = Math.round(parseFloat(order.total) * 100);
    if (amountCents < totalCents) {
      res.status(422).json({ error: `Amount (${body.data.amount}) is less than the order total (${order.total})` });
      return;
    }

    let payment: typeof paymentsTable.$inferSelect | undefined;

    await db.transaction(async (tx) => {
      [payment] = await tx
        .insert(paymentsTable)
        .values({
          orderId: order.id,
          businessId,
          locationId: order.locationId,
          amount: body.data.amount,
          tip: body.data.tip ?? "0",
          currencyCode: order.currencyCode,
          method: body.data.method,
          status: "completed",
          posSource: "manual",
          processedAt: body.data.processedAt ? new Date(body.data.processedAt) : new Date(),
          notes: body.data.notes ?? null,
          createdBy: userId,
        })
        .returning();

      await completeOrderInTx(tx, order, businessId, userId);
    });

    const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id)).limit(1);
    res.status(201).json({ payment, order: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── GET /payments ───────────────────────────────────────────────────────────

router.get("/payments", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions = [tenantWhere(paymentsTable.businessId, businessId)];
    if (req.query["orderId"]) conditions.push(eq(paymentsTable.orderId, req.query["orderId"] as string));
    if (req.query["method"]) conditions.push(eq(paymentsTable.method, req.query["method"] as any));
    if (req.query["from"]) conditions.push(gte(paymentsTable.processedAt, new Date(req.query["from"] as string)));
    if (req.query["to"]) conditions.push(lte(paymentsTable.processedAt, new Date(req.query["to"] as string)));

    const rows = await db
      .select()
      .from(paymentsTable)
      .where(and(...conditions))
      .orderBy(desc(paymentsTable.processedAt))
      .limit(200);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── GET /pos-connection ─────────────────────────────────────────────────────

router.get("/pos-connection", requireAuth, loadBusiness, requireRole("admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [conn] = await db
      .select()
      .from(posConnectionsTable)
      .where(eq(posConnectionsTable.businessId, businessId))
      .limit(1);
    res.json(conn ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── PUT /pos-connection ─────────────────────────────────────────────────────

const posConnectionSchema = z.object({
  name: z.string().min(1),
  apiUrl: z.string().url("Must be a valid URL"),
  apiKey: z.string().optional().nullable(),
});

router.put("/pos-connection", requireAuth, loadBusiness, requireRole("admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = posConnectionSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [conn] = await db
      .insert(posConnectionsTable)
      .values({ businessId, name: body.data.name, apiUrl: body.data.apiUrl, apiKey: body.data.apiKey ?? null })
      .onConflictDoUpdate({
        target: [posConnectionsTable.businessId],
        set: { name: body.data.name, apiUrl: body.data.apiUrl, apiKey: body.data.apiKey ?? null },
      })
      .returning();

    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── POST /payments/pos-sync ─────────────────────────────────────────────────
// Pull recent transactions from the configured POS and import any that match
// open orders. The POS API must implement the BizCore contract:
// GET {apiUrl}/transactions?from=ISO&to=ISO
// → { transactions: [{ id, bizcore_order_id?, amount, tip?, currency, method, processedAt }] }

router.post("/payments/pos-sync", requireAuth, loadBusiness, requireRole("admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [conn] = await db
      .select()
      .from(posConnectionsTable)
      .where(and(eq(posConnectionsTable.businessId, businessId), eq(posConnectionsTable.active, true)))
      .limit(1);

    if (!conn) { res.status(404).json({ error: "No active POS connection configured" }); return; }

    const now = new Date();
    const from = conn.lastSyncAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

    const url = `${conn.apiUrl}/transactions?from=${from.toISOString()}&to=${now.toISOString()}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (conn.apiKey) headers["Authorization"] = `Bearer ${conn.apiKey}`;

    let posData: any;
    try {
      const resp = await fetch(url, { headers });
      if (!resp.ok) { res.status(502).json({ error: `POS returned ${resp.status}` }); return; }
      posData = await resp.json();
    } catch (fetchErr) {
      res.status(502).json({ error: `Could not reach POS: ${fetchErr instanceof Error ? fetchErr.message : "network error"}` });
      return;
    }

    const transactions: any[] = Array.isArray(posData?.transactions) ? posData.transactions : [];
    let imported = 0; let skipped = 0; const errors: string[] = [];

    for (const txn of transactions) {
      if (!txn.id || !txn.amount || !txn.method || !txn.processedAt) { skipped++; continue; }

      // Match to a BizCore order if the POS included the order ID.
      if (!txn.bizcore_order_id) { skipped++; continue; }

      const [order] = await db
        .select()
        .from(ordersTable)
        .where(and(eq(ordersTable.id, txn.bizcore_order_id), tenantWhere(ordersTable.businessId, businessId)))
        .limit(1);

      if (!order || order.status === "completed" || order.status === "cancelled") { skipped++; continue; }

      try {
        await db.transaction(async (tx) => {
          await tx.insert(paymentsTable).values({
            orderId: order.id,
            businessId,
            locationId: order.locationId,
            amount: String(txn.amount),
            tip: txn.tip ? String(txn.tip) : "0",
            currencyCode: txn.currency ?? order.currencyCode,
            method: txn.method,
            status: "completed",
            externalTransactionId: txn.id,
            posSource: "pos_sync",
            processedAt: new Date(txn.processedAt),
            createdBy: "pos_sync",
          });
          await completeOrderInTx(tx, order, businessId, "pos_sync");
        });
        imported++;
      } catch (e) {
        errors.push(`Order ${txn.bizcore_order_id}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    // Update lastSyncAt.
    await db
      .update(posConnectionsTable)
      .set({ lastSyncAt: now })
      .where(eq(posConnectionsTable.id, conn.id));

    res.json({ imported, skipped, errors, syncedAt: now.toISOString() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
