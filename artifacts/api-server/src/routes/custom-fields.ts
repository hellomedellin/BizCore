import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customFieldsTable, customFieldValuesTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";

const router: IRouter = Router();

// GET /custom-fields?entityType=item|order|employee
router.get("/custom-fields", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = assertBusinessId(authedReq.businessId);
    const { entityType } = req.query;

    const conditions: ReturnType<typeof eq>[] = [
      eq(customFieldsTable.businessId, businessId),
    ];
    if (entityType && typeof entityType === "string") {
      conditions.push(eq(customFieldsTable.entityType, entityType));
    }

    const fields = await db
      .select()
      .from(customFieldsTable)
      .where(and(...conditions))
      .orderBy(customFieldsTable.sortOrder, customFieldsTable.id);

    res.json(fields);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: (err as Error).message });
  }
});

// POST /custom-fields (admin only)
router.post(
  "/custom-fields",
  requireAuth,
  loadBusiness,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    try {
      const businessId = assertBusinessId(authedReq.businessId);
      const { entityType, name, type, options, sortOrder, required } = req.body;

      if (!entityType || !name || !type) {
        res.status(400).json({ error: "entityType, name and type are required" });
        return;
      }

      const validEntityTypes = ["item", "order", "employee"];
      const validTypes = ["text", "number", "date", "select", "checkbox"];

      if (!validEntityTypes.includes(entityType)) {
        res.status(400).json({ error: "Invalid entityType" });
        return;
      }
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: "Invalid field type" });
        return;
      }

      const [field] = await db
        .insert(customFieldsTable)
        .values({
          businessId,
          entityType,
          name,
          type,
          options: options ?? null,
          sortOrder: sortOrder ?? 0,
          required: required ?? false,
        })
        .returning();

      res.status(201).json(field);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: (err as Error).message });
    }
  }
);

// PATCH /custom-fields/:id (admin only)
router.patch(
  "/custom-fields/:id",
  requireAuth,
  loadBusiness,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    try {
      const businessId = assertBusinessId(authedReq.businessId);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const existing = await db
        .select()
        .from(customFieldsTable)
        .where(and(eq(customFieldsTable.id, id), eq(customFieldsTable.businessId, businessId)))
        .limit(1);

      if (!existing.length) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      const { name, type, options, sortOrder, required } = req.body;
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (type !== undefined) updates.type = type;
      if (options !== undefined) updates.options = options;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;
      if (required !== undefined) updates.required = required;

      const [updated] = await db
        .update(customFieldsTable)
        .set(updates)
        .where(eq(customFieldsTable.id, id))
        .returning();

      res.json(updated);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: (err as Error).message });
    }
  }
);

// DELETE /custom-fields/:id (admin only)
router.delete(
  "/custom-fields/:id",
  requireAuth,
  loadBusiness,
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const authedReq = req as AuthedRequest;
    try {
      const businessId = assertBusinessId(authedReq.businessId);
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const existing = await db
        .select()
        .from(customFieldsTable)
        .where(and(eq(customFieldsTable.id, id), eq(customFieldsTable.businessId, businessId)))
        .limit(1);

      if (!existing.length) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      await db.delete(customFieldsTable).where(eq(customFieldsTable.id, id));
      res.status(204).end();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: (err as Error).message });
    }
  }
);

// GET /custom-field-values?entityType=item&entityId=123
router.get("/custom-field-values", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = assertBusinessId(authedReq.businessId);
    const { entityType, entityId } = req.query;

    if (!entityType || !entityId) {
      res.status(400).json({ error: "entityType and entityId are required" });
      return;
    }

    const entityIdNum = parseInt(entityId as string, 10);
    if (isNaN(entityIdNum)) {
      res.status(400).json({ error: "Invalid entityId" });
      return;
    }

    const fields = await db
      .select({ id: customFieldsTable.id })
      .from(customFieldsTable)
      .where(
        and(
          eq(customFieldsTable.businessId, businessId),
          eq(customFieldsTable.entityType, entityType as string)
        )
      );

    if (!fields.length) {
      res.json([]);
      return;
    }

    const fieldIds = fields.map((f) => f.id);
    const values = await db
      .select()
      .from(customFieldValuesTable)
      .where(
        and(
          inArray(customFieldValuesTable.fieldId, fieldIds),
          eq(customFieldValuesTable.entityId, entityIdNum)
        )
      );

    res.json(values);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: (err as Error).message });
  }
});

// PUT /custom-field-values (upsert)
router.put("/custom-field-values", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = assertBusinessId(authedReq.businessId);
    const { entityType, entityId, values } = req.body;

    if (!entityType || !entityId || !Array.isArray(values)) {
      res.status(400).json({ error: "entityType, entityId, and values array are required" });
      return;
    }

    const entityIdNum = parseInt(String(entityId), 10);
    if (isNaN(entityIdNum)) {
      res.status(400).json({ error: "Invalid entityId" });
      return;
    }

    const businessFields = await db
      .select({ id: customFieldsTable.id })
      .from(customFieldsTable)
      .where(
        and(
          eq(customFieldsTable.businessId, businessId),
          eq(customFieldsTable.entityType, entityType)
        )
      );

    const validFieldIds = new Set(businessFields.map((f) => f.id));
    const toUpsert = (values as { fieldId: number; value?: string | null }[]).filter((v) =>
      validFieldIds.has(v.fieldId)
    );

    if (!toUpsert.length) {
      res.json([]);
      return;
    }

    const results = await Promise.all(
      toUpsert.map(async ({ fieldId, value }) => {
        const existing = await db
          .select()
          .from(customFieldValuesTable)
          .where(
            and(
              eq(customFieldValuesTable.fieldId, fieldId),
              eq(customFieldValuesTable.entityId, entityIdNum)
            )
          )
          .limit(1);

        if (existing.length) {
          const [updated] = await db
            .update(customFieldValuesTable)
            .set({ value: value ?? null })
            .where(eq(customFieldValuesTable.id, existing[0].id))
            .returning();
          return updated;
        } else {
          const [created] = await db
            .insert(customFieldValuesTable)
            .values({ fieldId, entityId: entityIdNum, value: value ?? null })
            .returning();
          return created;
        }
      })
    );

    res.json(results);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: (err as Error).message });
  }
});

export default router;
