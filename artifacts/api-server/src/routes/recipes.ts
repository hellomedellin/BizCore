import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { recipesTable, recipeItemsTable, itemsTable, itemVariantsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

router.get("/items/:itemId/recipe", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const itemId = parseInt(req.params.itemId as string);
    if (isNaN(itemId)) {
      res.status(400).json({ error: "Invalid itemId" });
      return;
    }

    const [item] = await db
      .select({ id: itemsTable.id })
      .from(itemsTable)
      .where(and(eq(itemsTable.id, itemId), tenantWhere(itemsTable.businessId, businessId!)));
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const [recipe] = await db
      .select()
      .from(recipesTable)
      .where(eq(recipesTable.menuItemId, itemId));

    if (!recipe) {
      res.status(404).json({ error: "No recipe found" });
      return;
    }

    const recipeItems = await db
      .select({
        id: recipeItemsTable.id,
        recipeId: recipeItemsTable.recipeId,
        ingredientVariantId: recipeItemsTable.ingredientVariantId,
        quantity: recipeItemsTable.quantity,
        unit: recipeItemsTable.unit,
        ingredientName: itemsTable.name,
        variantName: itemVariantsTable.name,
      })
      .from(recipeItemsTable)
      .innerJoin(itemVariantsTable, eq(recipeItemsTable.ingredientVariantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(eq(recipeItemsTable.recipeId, recipe.id));

    res.json({ ...recipe, items: recipeItems });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

const upsertRecipeSchema = z.object({
  name: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  items: z.array(
    z.object({
      ingredientVariantId: z.number().int(),
      quantity: z.string(),
      unit: z.string().nullable().optional(),
    }),
  ),
});

router.put("/items/:itemId/recipe", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const itemId = parseInt(req.params.itemId as string);
    if (isNaN(itemId)) {
      res.status(400).json({ error: "Invalid itemId" });
      return;
    }

    const [item] = await db
      .select({ id: itemsTable.id })
      .from(itemsTable)
      .where(and(eq(itemsTable.id, itemId), tenantWhere(itemsTable.businessId, businessId!)));
    if (!item) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    const body = upsertRecipeSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const [existing] = await db
      .select({ id: recipesTable.id })
      .from(recipesTable)
      .where(eq(recipesTable.menuItemId, itemId));

    let recipeId: number;
    if (existing) {
      await db
        .update(recipesTable)
        .set({ name: body.data.name ?? null, notes: body.data.notes ?? null })
        .where(eq(recipesTable.id, existing.id));
      recipeId = existing.id;
      await db.delete(recipeItemsTable).where(eq(recipeItemsTable.recipeId, recipeId));
    } else {
      const [newRecipe] = await db
        .insert(recipesTable)
        .values({ menuItemId: itemId, name: body.data.name ?? null, notes: body.data.notes ?? null })
        .returning();
      recipeId = newRecipe.id;
    }

    if (body.data.items.length > 0) {
      await db.insert(recipeItemsTable).values(
        body.data.items.map((ri) => ({
          recipeId,
          ingredientVariantId: ri.ingredientVariantId,
          quantity: ri.quantity,
          unit: ri.unit ?? null,
        })),
      );
    }

    const [recipe] = await db.select().from(recipesTable).where(eq(recipesTable.id, recipeId));
    const recipeItems = await db
      .select({
        id: recipeItemsTable.id,
        recipeId: recipeItemsTable.recipeId,
        ingredientVariantId: recipeItemsTable.ingredientVariantId,
        quantity: recipeItemsTable.quantity,
        unit: recipeItemsTable.unit,
        ingredientName: itemsTable.name,
        variantName: itemVariantsTable.name,
      })
      .from(recipeItemsTable)
      .innerJoin(itemVariantsTable, eq(recipeItemsTable.ingredientVariantId, itemVariantsTable.id))
      .innerJoin(itemsTable, eq(itemVariantsTable.itemId, itemsTable.id))
      .where(eq(recipeItemsTable.recipeId, recipeId));

    res.json({ ...recipe, items: recipeItems });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: msg });
  }
});

export default router;
