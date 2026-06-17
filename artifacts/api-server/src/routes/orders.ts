import { Router } from "express";
import { db } from "@bizcore/db";
import {
  ordersTable, orderLinesTable, orderStatusHistoryTable,
  itemVariantsTable, itemsTable, businessesTable,
} from "@bizcore/db/schema";
import { eq, and, ne, desc, SQL } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireRole, requireModule, requireApiKey, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { computeOrderTotals, centsToString } from "../lib/money";
import { isLocationAllowed } from "../lib/access";
import { completeOrderInTx } from "../lib/order-completion";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("orders")];

router.get("/orders", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions: SQL[] = [tenantWhere(ordersTable.businessId, businessId)];
    if (req.query["locationId"]) conditions.push(eq(ordersTable.locationId, req.query["locationId"] as string));
    if (req.query["status"]) conditions.push(eq(ordersTable.status, req.query["status"] as any));
    if (req.query["orderType"]) conditions.push(eq(ordersTable.orderType, req.query["orderType"] as any));

    const limit = Math.min(parseInt(req.query["limit"] as string || "50", 10), 200);
    const rows = await db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt)).limit(limit);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const orderLineInputSchema = z.object({
  variantId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  quantity: z.string(),
  unitPrice: z.string(),
  notes: z.string().nullable().optional(),
  modifiers: z.array(z.object({ name: z.string(), priceAdjustment: z.number() })).optional(),
});

const createOrderSchema = z.object({
  locationId: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  orderType: z.enum(["dine_in", "pickup", "delivery", "service", "retail"]).default("retail"),
  tableNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  discount: z.string().optional(),
  tax: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  externalRef: z.string().nullable().optional(),
  lines: z.array(orderLineInputSchema).min(1),
});

router.post("/orders", ...guard, async (req, res): Promise<void> => {
  const { businessId, userId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = createOrderSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const totals = computeOrderTotals(body.data.lines, body.data.discount ?? "0", body.data.tax ?? "0");

    const result = await db.transaction(async (tx) => {
      const [biz] = await tx.select({ currencyCode: businessesTable.currencyCode }).from(businessesTable).where(eq(businessesTable.id, businessId));

      const [order] = await tx.insert(ordersTable).values({
        businessId,
        locationId: body.data.locationId,
        customerId: body.data.customerId ?? null,
        orderType: body.data.orderType,
        source: "internal",
        externalRef: body.data.externalRef ?? null,
        tableNumber: body.data.tableNumber ?? null,
        notes: body.data.notes ?? null,
        subtotal: centsToString(totals.subtotalCents),
        discount: centsToString(totals.discountCents),
        tax: centsToString(totals.taxCents),
        total: centsToString(totals.totalCents),
        currencyCode: body.data.currencyCode ?? biz?.currencyCode ?? "USD",
        createdBy: userId,
      }).returning();

      const lineValues = body.data.lines.map((l, i) => ({
        orderId: order!.id,
        variantId: l.variantId ?? null,
        name: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        lineTotal: centsToString(totals.lineTotalsCents[i]!),
        notes: l.notes ?? null,
        modifiers: l.modifiers ?? null,
      }));
      await tx.insert(orderLinesTable).values(lineValues);

      await tx.insert(orderStatusHistoryTable).values({ orderId: order!.id, toStatus: "pending", changedBy: userId });

      return order!;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// External POS order intake
router.post("/orders/ingest", requireApiKey, async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = createOrderSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    const totals = computeOrderTotals(body.data.lines, body.data.discount ?? "0", body.data.tax ?? "0");

    const order = await db.transaction(async (tx) => {
      const [biz] = await tx.select({ currencyCode: businessesTable.currencyCode }).from(businessesTable).where(eq(businessesTable.id, businessId));
      const [o] = await tx.insert(ordersTable).values({
        businessId,
        locationId: body.data.locationId,
        customerId: body.data.customerId ?? null,
        orderType: body.data.orderType,
        source: "api",
        externalRef: body.data.externalRef ?? null,
        tableNumber: body.data.tableNumber ?? null,
        notes: body.data.notes ?? null,
        subtotal: centsToString(totals.subtotalCents),
        discount: centsToString(totals.discountCents),
        tax: centsToString(totals.taxCents),
        total: centsToString(totals.totalCents),
        currencyCode: body.data.currencyCode ?? biz?.currencyCode ?? "USD",
        createdBy: "api",
      }).returning();
      await tx.insert(orderLinesTable).values(
        body.data.lines.map((l, i) => ({
          orderId: o!.id,
          variantId: l.variantId ?? null,
          name: l.name,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: centsToString(totals.lineTotalsCents[i]!),
          notes: l.notes ?? null,
          modifiers: l.modifiers ?? null,
        }))
      );
      await tx.insert(orderStatusHistoryTable).values({ orderId: o!.id, toStatus: "pending", changedBy: "api" });
      return o!;
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/orders/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [order] = await db.select().from(ordersTable).where(
      and(eq(ordersTable.id, req.params["id"] as string), tenantWhere(ordersTable.businessId, businessId))
    );
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, order.id));
    const history = await db.select().from(orderStatusHistoryTable).where(eq(orderStatusHistoryTable.orderId, order.id)).orderBy(orderStatusHistoryTable.changedAt);
    res.json({ ...order, lines, history });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Valid status moves. Terminal states (completed/cancelled) allow no further change.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "in_progress", "ready", "completed", "cancelled"],
  confirmed: ["in_progress", "ready", "completed", "cancelled"],
  in_progress: ["ready", "completed", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

// Status transition — deducts inventory exactly once, on the move into "completed"
router.patch("/orders/:id/status", ...guard, async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const body = z.object({ status: z.enum(["confirmed", "in_progress", "ready", "completed", "cancelled"]) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [order] = await db.select().from(ordersTable).where(
      and(eq(ordersTable.id, req.params["id"] as string), tenantWhere(ordersTable.businessId, businessId))
    );
    if (!order) { res.status(404).json({ error: "Not found" }); return; }

    const next = body.data.status;
    if (!(ALLOWED_TRANSITIONS[order.status] ?? []).includes(next)) {
      res.status(409).json({ error: `Cannot change a ${order.status} order to ${next}.` });
      return;
    }

    await db.transaction(async (tx) => {
      if (next !== "completed") {
        await tx.update(ordersTable).set({ status: next }).where(eq(ordersTable.id, order.id));
        await tx.insert(orderStatusHistoryTable).values({ orderId: order.id, fromStatus: order.status, toStatus: next, changedBy: userId });
        return;
      }
      await completeOrderInTx(tx, order, businessId, userId);
    });

    const [updated] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id));
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
