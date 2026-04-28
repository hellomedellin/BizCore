import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderLinesTable, customersTable, locationsTable } from "@workspace/db/schema";
import { eq, and, ilike, gte, lte, sql, SQL, desc, count } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

const CreateOrderBodySchema = z.object({
  locationId: z.number().int(),
  orderType: z.enum(["dine_in", "pickup", "delivery"]).default("dine_in"),
  customerId: z.number().int().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lines: z
    .array(
      z.object({
        variantId: z.number().int().nullable().optional(),
        name: z.string().min(1),
        quantity: z.string(),
        price: z.string(),
        notes: z.string().nullable().optional(),
        modifiers: z.record(z.unknown()).nullable().optional(),
      })
    )
    .optional()
    .default([]),
});

const UpdateOrderBodySchema = z.object({
  status: z
    .enum(["pending", "preparing", "ready", "completed", "cancelled", "refunded"])
    .optional(),
  customerId: z.number().int().nullable().optional(),
  tableNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  discount: z.string().optional(),
});

const AddOrderLineBodySchema = z.object({
  variantId: z.number().int().nullable().optional(),
  name: z.string().min(1),
  quantity: z.string(),
  price: z.string(),
  notes: z.string().nullable().optional(),
  modifiers: z.record(z.unknown()).nullable().optional(),
});

const UpdateOrderLineBodySchema = z.object({
  quantity: z.string().optional(),
  price: z.string().optional(),
  notes: z.string().nullable().optional(),
  modifiers: z.record(z.unknown()).nullable().optional(),
});

async function recalcOrder(orderId: number): Promise<void> {
  const lines = await db
    .select({ quantity: orderLinesTable.quantity, price: orderLinesTable.price })
    .from(orderLinesTable)
    .where(eq(orderLinesTable.orderId, orderId));

  const subtotal = lines.reduce(
    (acc, l) => acc + parseFloat(l.quantity) * parseFloat(l.price),
    0
  );

  const [order] = await db
    .select({ discount: ordersTable.discount, tax: ordersTable.tax })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId));

  const discount = parseFloat(order?.discount ?? "0");
  const tax = parseFloat(order?.tax ?? "0");
  const total = Math.max(0, subtotal - discount + tax);

  await db
    .update(ordersTable)
    .set({
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
    })
    .where(eq(ordersTable.id, orderId));
}

async function getOrderDetail(orderId: number) {
  const [order] = await db
    .select({
      id: ordersTable.id,
      businessId: ordersTable.businessId,
      locationId: ordersTable.locationId,
      customerId: ordersTable.customerId,
      customerName: customersTable.name,
      orderType: ordersTable.orderType,
      status: ordersTable.status,
      tableNumber: ordersTable.tableNumber,
      notes: ordersTable.notes,
      subtotal: ordersTable.subtotal,
      discount: ordersTable.discount,
      tax: ordersTable.tax,
      total: ordersTable.total,
      createdBy: ordersTable.createdBy,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
    .where(eq(ordersTable.id, orderId));

  if (!order) return null;

  const lines = await db
    .select()
    .from(orderLinesTable)
    .where(eq(orderLinesTable.orderId, orderId))
    .orderBy(orderLinesTable.createdAt);

  return {
    ...order,
    subtotal: String(order.subtotal),
    discount: String(order.discount),
    tax: String(order.tax),
    total: String(order.total),
    lines: lines.map((l) => ({
      ...l,
      quantity: String(l.quantity),
      price: String(l.price),
    })),
  };
}

router.get("/orders", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const { locationId, status, orderType, search, dateFrom, dateTo, limit, offset } = req.query;
    const lim = Math.min(parseInt((limit as string) || "50"), 200);
    const off = parseInt((offset as string) || "0") || 0;

    const conditions: SQL[] = [tenantWhere(ordersTable.businessId, businessId!)];

    if (locationId && !isNaN(parseInt(locationId as string))) {
      conditions.push(eq(ordersTable.locationId, parseInt(locationId as string)));
    }
    if (status && typeof status === "string") {
      conditions.push(eq(ordersTable.status, status));
    }
    if (orderType && typeof orderType === "string") {
      conditions.push(eq(ordersTable.orderType, orderType));
    }
    if (dateFrom && typeof dateFrom === "string") {
      conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
    }
    if (dateTo && typeof dateTo === "string") {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      conditions.push(lte(ordersTable.createdAt, to));
    }
    if (search && typeof search === "string" && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(ilike(customersTable.name, q));
    }

    const whereClause = and(...conditions);

    const [totalResult] = await db
      .select({ count: count() })
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .where(whereClause);

    const orders = await db
      .select({
        id: ordersTable.id,
        businessId: ordersTable.businessId,
        locationId: ordersTable.locationId,
        customerId: ordersTable.customerId,
        customerName: customersTable.name,
        orderType: ordersTable.orderType,
        status: ordersTable.status,
        tableNumber: ordersTable.tableNumber,
        notes: ordersTable.notes,
        subtotal: ordersTable.subtotal,
        discount: ordersTable.discount,
        tax: ordersTable.tax,
        total: ordersTable.total,
        createdBy: ordersTable.createdBy,
        createdAt: ordersTable.createdAt,
        updatedAt: ordersTable.updatedAt,
      })
      .from(ordersTable)
      .leftJoin(customersTable, eq(ordersTable.customerId, customersTable.id))
      .where(whereClause)
      .orderBy(desc(ordersTable.createdAt))
      .limit(lim)
      .offset(off);

    res.json({
      orders: orders.map((o) => ({
        ...o,
        subtotal: String(o.subtotal),
        discount: String(o.discount),
        tax: String(o.tax),
        total: String(o.total),
      })),
      total: totalResult?.count ?? 0,
    });
  } catch (err: unknown) {
    console.error("GET /orders error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders", requireAuth, loadBusiness, requireRole("admin", "manager", "cashier"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const body = CreateOrderBodySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const { locationId, orderType, customerId, tableNumber, notes, lines } = body.data;

    const [location] = await db
      .select({ id: locationsTable.id })
      .from(locationsTable)
      .where(and(eq(locationsTable.id, locationId), tenantWhere(locationsTable.businessId, businessId!)));
    if (!location) { res.status(403).json({ error: "Location not found or forbidden" }); return; }

    if (customerId) {
      const [customer] = await db
        .select({ id: customersTable.id })
        .from(customersTable)
        .where(and(eq(customersTable.id, customerId), tenantWhere(customersTable.businessId, businessId!)));
      if (!customer) { res.status(403).json({ error: "Customer not found or forbidden" }); return; }
    }

    const [order] = await db
      .insert(ordersTable)
      .values({
        businessId: businessId!,
        locationId,
        orderType,
        customerId: customerId ?? null,
        tableNumber: tableNumber ?? null,
        notes: notes ?? null,
        createdBy: authedReq.userId ?? null,
        status: "pending",
      })
      .returning();

    if (lines && lines.length > 0) {
      await db.insert(orderLinesTable).values(
        lines.map((l) => ({
          orderId: order.id,
          variantId: l.variantId ?? null,
          name: l.name,
          quantity: l.quantity,
          price: l.price,
          notes: l.notes ?? null,
          modifiers: l.modifiers ?? null,
        }))
      );
      await recalcOrder(order.id);
    }

    const detail = await getOrderDetail(order.id);
    res.status(201).json(detail);
  } catch (err: unknown) {
    console.error("POST /orders error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/orders/:id", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const detail = await getOrderDetail(id);
    if (!detail || detail.businessId !== businessId) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(detail);
  } catch (err: unknown) {
    console.error("GET /orders/:id error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/orders/:id", requireAuth, loadBusiness, requireRole("admin", "manager", "cashier"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = UpdateOrderBodySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db
      .select({ id: ordersTable.id, businessId: ordersTable.businessId, status: ordersTable.status })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), tenantWhere(ordersTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    const protectedStatuses = ["cancelled", "refunded"];
    if (body.data.status && protectedStatuses.includes(body.data.status) && authedReq.userRole === "cashier") {
      res.status(403).json({ error: "Cashier cannot cancel or refund orders" });
      return;
    }

    if (body.data.customerId) {
      const [customer] = await db
        .select({ id: customersTable.id })
        .from(customersTable)
        .where(and(eq(customersTable.id, body.data.customerId), tenantWhere(customersTable.businessId, businessId!)));
      if (!customer) { res.status(403).json({ error: "Customer not found or forbidden" }); return; }
    }

    const updates: Record<string, unknown> = {};
    if (body.data.status !== undefined) updates.status = body.data.status;
    if (body.data.customerId !== undefined) updates.customerId = body.data.customerId;
    if (body.data.tableNumber !== undefined) updates.tableNumber = body.data.tableNumber;
    if (body.data.notes !== undefined) updates.notes = body.data.notes;
    if (body.data.discount !== undefined) {
      updates.discount = body.data.discount;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id));
    }

    if (body.data.discount !== undefined) {
      await recalcOrder(id);
    }

    const detail = await getOrderDetail(id);
    res.json(detail);
  } catch (err: unknown) {
    console.error("PATCH /orders/:id error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/orders/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [existing] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), tenantWhere(ordersTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Order not found" }); return; }

    await db.delete(ordersTable).where(eq(ordersTable.id, id));
    res.status(204).end();
  } catch (err: unknown) {
    console.error("DELETE /orders/:id error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders/:orderId/lines", requireAuth, loadBusiness, requireRole("admin", "manager", "cashier"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const orderId = parseInt(req.params.orderId as string);
    if (isNaN(orderId)) { res.status(400).json({ error: "Invalid orderId" }); return; }

    const body = AddOrderLineBodySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [order] = await db
      .select({ id: ordersTable.id, status: ordersTable.status })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), tenantWhere(ordersTable.businessId, businessId!)));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (["completed", "cancelled", "refunded"].includes(order.status)) {
      res.status(400).json({ error: "Cannot add lines to a completed/cancelled/refunded order" });
      return;
    }

    await db.insert(orderLinesTable).values({
      orderId,
      variantId: body.data.variantId ?? null,
      name: body.data.name,
      quantity: body.data.quantity,
      price: body.data.price,
      notes: body.data.notes ?? null,
      modifiers: body.data.modifiers ?? null,
    });

    await recalcOrder(orderId);
    const detail = await getOrderDetail(orderId);
    res.status(201).json(detail);
  } catch (err: unknown) {
    console.error("POST /orders/:orderId/lines error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/orders/:orderId/lines/:lineId", requireAuth, loadBusiness, requireRole("admin", "manager", "cashier"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const orderId = parseInt(req.params.orderId as string);
    const lineId = parseInt(req.params.lineId as string);
    if (isNaN(orderId) || isNaN(lineId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = UpdateOrderLineBodySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [order] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), tenantWhere(ordersTable.businessId, businessId!)));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const [line] = await db
      .select({ id: orderLinesTable.id })
      .from(orderLinesTable)
      .where(and(eq(orderLinesTable.id, lineId), eq(orderLinesTable.orderId, orderId)));
    if (!line) { res.status(404).json({ error: "Order line not found" }); return; }

    const updates: Record<string, unknown> = {};
    if (body.data.quantity !== undefined) updates.quantity = body.data.quantity;
    if (body.data.price !== undefined) updates.price = body.data.price;
    if (body.data.notes !== undefined) updates.notes = body.data.notes;
    if (body.data.modifiers !== undefined) updates.modifiers = body.data.modifiers;

    if (Object.keys(updates).length > 0) {
      await db.update(orderLinesTable).set(updates).where(eq(orderLinesTable.id, lineId));
    }

    await recalcOrder(orderId);
    const detail = await getOrderDetail(orderId);
    res.json(detail);
  } catch (err: unknown) {
    console.error("PATCH /orders/:orderId/lines/:lineId error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/orders/:orderId/lines/:lineId", requireAuth, loadBusiness, requireRole("admin", "manager", "cashier"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const orderId = parseInt(req.params.orderId as string);
    const lineId = parseInt(req.params.lineId as string);
    if (isNaN(orderId) || isNaN(lineId)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [order] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), tenantWhere(ordersTable.businessId, businessId!)));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    await db.delete(orderLinesTable).where(
      and(eq(orderLinesTable.id, lineId), eq(orderLinesTable.orderId, orderId))
    );

    await recalcOrder(orderId);
    const detail = await getOrderDetail(orderId);
    res.json(detail);
  } catch (err: unknown) {
    console.error("DELETE /orders/:orderId/lines/:lineId error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
