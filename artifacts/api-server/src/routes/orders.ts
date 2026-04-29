import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ordersTable,
  orderLinesTable,
  customersTable,
  locationsTable,
  orderStatusHistoryTable,
  recipesTable,
  recipeItemsTable,
  itemVariantsTable,
  inventoryTable,
  inventoryTransactionsTable,
} from "@workspace/db/schema";
import { eq, and, ilike, gte, lte, sql, SQL, desc, count, inArray, sum, asc, isNotNull } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

const numericString = z.string().regex(/^\d+(\.\d{1,4})?$/, "Must be a non-negative number");

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
        quantity: numericString,
        price: numericString,
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
  discount: numericString.optional(),
});

const AddOrderLineBodySchema = z.object({
  variantId: z.number().int().nullable().optional(),
  name: z.string().min(1),
  quantity: numericString,
  price: numericString,
  notes: z.string().nullable().optional(),
  modifiers: z.record(z.unknown()).nullable().optional(),
});

const UpdateOrderLineBodySchema = z.object({
  quantity: numericString.optional(),
  price: numericString.optional(),
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

  const statusHistory = await db
    .select()
    .from(orderStatusHistoryTable)
    .where(eq(orderStatusHistoryTable.orderId, orderId))
    .orderBy(orderStatusHistoryTable.changedAt);

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
    statusHistory,
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

    await db.insert(orderStatusHistoryTable).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: "pending",
      changedBy: authedReq.userId ?? null,
    });

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

    if (body.data.status !== undefined) {
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        pending: ["preparing", "cancelled"],
        preparing: ["ready", "cancelled"],
        ready: ["completed", "cancelled"],
        completed: ["refunded"],
        cancelled: [],
        refunded: [],
      };
      const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(body.data.status)) {
        res.status(400).json({
          error: `Cannot transition from '${existing.status}' to '${body.data.status}'`,
        });
        return;
      }
      const managerOnlyStatuses = ["cancelled", "refunded"];
      if (managerOnlyStatuses.includes(body.data.status) && authedReq.userRole === "cashier") {
        res.status(403).json({ error: "Cashier cannot cancel or refund orders" });
        return;
      }
    }

    if (body.data.discount !== undefined && authedReq.userRole === "cashier") {
      res.status(403).json({ error: "Cashier cannot modify discounts" });
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

    if (body.data.status !== undefined && body.data.status !== existing.status) {
      await db.insert(orderStatusHistoryTable).values({
        orderId: id,
        fromStatus: existing.status,
        toStatus: body.data.status,
        changedBy: authedReq.userId ?? null,
      });
    }

    // Recipe enforcement: deduct ingredients from inventory when order is completed
    if (body.data.status === "completed" && existing.status !== "completed") {
      const [order] = await db
        .select({ locationId: ordersTable.locationId })
        .from(ordersTable)
        .where(eq(ordersTable.id, id));

      if (order) {
        // Get all order lines that have a variantId
        const lines = await db
          .select({ variantId: orderLinesTable.variantId, quantity: orderLinesTable.quantity })
          .from(orderLinesTable)
          .where(and(eq(orderLinesTable.orderId, id)));

        const linesWithVariant = lines.filter((l) => l.variantId !== null);
        if (linesWithVariant.length > 0) {
          // Get item IDs for all variants
          const variantIds = linesWithVariant.map((l) => l.variantId!);
          const variants = await db
            .select({ id: itemVariantsTable.id, itemId: itemVariantsTable.itemId })
            .from(itemVariantsTable)
            .where(inArray(itemVariantsTable.id, variantIds));

          const variantToItemMap = new Map(variants.map((v) => [v.id, v.itemId]));
          const itemIds = [...new Set(variants.map((v) => v.itemId))];

          if (itemIds.length > 0) {
            // Get recipes for these items
            const recipes = await db
              .select({ id: recipesTable.id, menuItemId: recipesTable.menuItemId })
              .from(recipesTable)
              .where(inArray(recipesTable.menuItemId, itemIds));

            if (recipes.length > 0) {
              const recipeIds = recipes.map((r) => r.id);
              const itemToRecipeMap = new Map(recipes.map((r) => [r.menuItemId, r.id]));

              // Get all recipe items (ingredients)
              const recipeItems = await db
                .select({
                  recipeId: recipeItemsTable.recipeId,
                  ingredientVariantId: recipeItemsTable.ingredientVariantId,
                  quantity: recipeItemsTable.quantity,
                })
                .from(recipeItemsTable)
                .where(inArray(recipeItemsTable.recipeId, recipeIds));

              // Build deduction map: ingredientVariantId → total quantity to deduct
              const deductions = new Map<number, number>();
              for (const line of linesWithVariant) {
                const itemId = variantToItemMap.get(line.variantId!);
                if (!itemId) continue;
                const recipeId = itemToRecipeMap.get(itemId);
                if (!recipeId) continue;
                const ingredients = recipeItems.filter((ri) => ri.recipeId === recipeId);
                for (const ingredient of ingredients) {
                  const qty = parseFloat(line.quantity) * parseFloat(ingredient.quantity);
                  deductions.set(ingredient.ingredientVariantId, (deductions.get(ingredient.ingredientVariantId) ?? 0) + qty);
                }
              }

              // Insert inventory transactions with FIFO batch consumption
              for (const [ingredientVariantId, totalQty] of deductions) {
                let remaining = totalQty;

                // FIFO: find batches with remaining positive qty, ordered by expiresAt ASC
                const batches = await db
                  .select({
                    batchId: inventoryTransactionsTable.batchId,
                    expiresAt: inventoryTransactionsTable.expiresAt,
                    remaining: sum(inventoryTransactionsTable.quantityChange),
                  })
                  .from(inventoryTransactionsTable)
                  .where(
                    and(
                      eq(inventoryTransactionsTable.variantId, ingredientVariantId),
                      eq(inventoryTransactionsTable.locationId, order.locationId),
                      isNotNull(inventoryTransactionsTable.batchId)
                    )
                  )
                  .groupBy(
                    inventoryTransactionsTable.batchId,
                    inventoryTransactionsTable.expiresAt
                  )
                  .orderBy(asc(inventoryTransactionsTable.expiresAt));

                // Consume batches FIFO (oldest expiresAt first)
                for (const batch of batches) {
                  if (remaining <= 0) break;
                  const batchRemaining = parseFloat(batch.remaining ?? "0");
                  if (batchRemaining <= 0) continue;
                  const consume = Math.min(remaining, batchRemaining);
                  await db.insert(inventoryTransactionsTable).values({
                    variantId: ingredientVariantId,
                    locationId: order.locationId,
                    type: "sale",
                    quantityChange: (-consume).toFixed(3),
                    batchId: batch.batchId,
                    expiresAt: batch.expiresAt,
                    referenceType: "order",
                    referenceId: id,
                    notes: `Recipe deduction (batch ${batch.batchId}) for order #${id}`,
                    createdBy: authedReq.userId ?? null,
                  });
                  remaining -= consume;
                }

                // Any remaining qty not covered by batches gets a generic deduction
                if (remaining > 0.0001) {
                  await db.insert(inventoryTransactionsTable).values({
                    variantId: ingredientVariantId,
                    locationId: order.locationId,
                    type: "sale",
                    quantityChange: (-remaining).toFixed(3),
                    referenceType: "order",
                    referenceId: id,
                    notes: `Recipe deduction for order #${id}`,
                    createdBy: authedReq.userId ?? null,
                  });
                }

                // Update inventory table aggregate quantity
                await db
                  .update(inventoryTable)
                  .set({
                    quantity: sql`${inventoryTable.quantity} - ${totalQty.toFixed(3)}`,
                    updatedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(inventoryTable.variantId, ingredientVariantId),
                      eq(inventoryTable.locationId, order.locationId)
                    )
                  );
              }
            }
          }
        }
      }
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
      .select({ id: ordersTable.id, status: ordersTable.status })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), tenantWhere(ordersTable.businessId, businessId!)));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (["completed", "cancelled", "refunded"].includes(order.status)) {
      res.status(400).json({ error: "Cannot modify lines on a completed/cancelled/refunded order" });
      return;
    }

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
      .select({ id: ordersTable.id, status: ordersTable.status })
      .from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), tenantWhere(ordersTable.businessId, businessId!)));
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (["completed", "cancelled", "refunded"].includes(order.status)) {
      res.status(400).json({ error: "Cannot remove lines from a completed/cancelled/refunded order" });
      return;
    }

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
