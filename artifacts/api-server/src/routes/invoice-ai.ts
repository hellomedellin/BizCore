import { Router } from "express";
import { db } from "@bizcore/db";
import { purchaseOrdersTable, purchaseOrderLinesTable } from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { requireAuth, loadBusiness, requireModule, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("invoice_ai")];

const s3 = new S3Client({ region: process.env["AWS_REGION"] ?? "us-east-1" });
const sqs = new SQSClient({ region: process.env["AWS_REGION"] ?? "us-east-1" });

const BUCKET = process.env["INVOICE_BUCKET"] ?? "";
const SQS_URL = process.env["INVOICE_SQS_URL"] ?? "";

// Get a presigned URL to upload an invoice to S3 directly from the browser
router.post("/invoice-ai/upload-url", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.object({
      locationId: z.string().uuid(),
      supplierId: z.string().uuid().nullable().optional(),
      filename: z.string().min(1),
      contentType: z.string().regex(/^(image\/(jpeg|png|webp)|application\/pdf)$/),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    // Create a draft PO placeholder first so the AI result has somewhere to land
    const [po] = await db.insert(purchaseOrdersTable).values({
      businessId,
      locationId: body.data.locationId,
      supplierId: body.data.supplierId ?? null,
      status: "ai_processing",
      source: "invoice_ai",
    }).returning();

    const s3Key = `invoices/${businessId}/${po!.id}/${Date.now()}-${body.data.filename}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: body.data.contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    // After upload the client calls /invoice-ai/trigger to kick off processing
    res.json({ purchaseOrderId: po!.id, uploadUrl, s3Key });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Called by the client after the S3 upload completes to queue the AI job
router.post("/invoice-ai/trigger", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.object({ purchaseOrderId: z.string().uuid(), s3Key: z.string().min(1) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [po] = await db.select().from(purchaseOrdersTable).where(
      and(eq(purchaseOrdersTable.id, body.data.purchaseOrderId), tenantWhere(purchaseOrdersTable.businessId, businessId))
    );
    if (!po) { res.status(404).json({ error: "Purchase order not found" }); return; }

    // Record the invoice URL and keep status ai_processing
    await db.update(purchaseOrdersTable).set({ invoiceUrl: body.data.s3Key }).where(eq(purchaseOrdersTable.id, po.id));

    // Enqueue for Lambda processing
    await sqs.send(new SendMessageCommand({
      QueueUrl: SQS_URL,
      MessageBody: JSON.stringify({ purchaseOrderId: po.id, businessId, s3Key: body.data.s3Key }),
    }));

    res.json({ message: "Invoice queued for AI processing", purchaseOrderId: po.id });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Poll status — called by frontend every 3s while status is ai_processing
router.get("/invoice-ai/:purchaseOrderId", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [po] = await db.select().from(purchaseOrdersTable).where(
      and(eq(purchaseOrdersTable.id, req.params["purchaseOrderId"]!), tenantWhere(purchaseOrdersTable.businessId, businessId))
    );
    if (!po) { res.status(404).json({ error: "Not found" }); return; }

    const lines = await db.select().from(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.purchaseOrderId, po.id));
    res.json({ ...po, lines });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Human review — confirm AI-extracted PO lines, update matching, accept or discard
router.patch("/invoice-ai/:purchaseOrderId/review", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.object({
      supplierId: z.string().uuid().nullable().optional(),
      notes: z.string().nullable().optional(),
      lines: z.array(z.object({
        id: z.string().uuid(),
        variantId: z.string().uuid().nullable().optional(),
        description: z.string().optional(),
        quantity: z.string().optional(),
        unitId: z.string().uuid().nullable().optional(),
        unitCost: z.string().optional(),
        matched: z.boolean().optional(),
      })),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [po] = await db.select().from(purchaseOrdersTable).where(
      and(eq(purchaseOrdersTable.id, req.params["purchaseOrderId"]!), tenantWhere(purchaseOrdersTable.businessId, businessId))
    );
    if (!po) { res.status(404).json({ error: "Not found" }); return; }

    await db.update(purchaseOrdersTable).set({
      status: "ai_complete",
      supplierId: body.data.supplierId ?? po.supplierId,
      notes: body.data.notes ?? po.notes,
    }).where(eq(purchaseOrdersTable.id, po.id));

    for (const line of body.data.lines) {
      const update: Record<string, unknown> = {};
      if (line.variantId !== undefined) update["variantId"] = line.variantId;
      if (line.description !== undefined) update["description"] = line.description;
      if (line.quantity !== undefined) update["quantity"] = line.quantity;
      if (line.unitId !== undefined) update["unitId"] = line.unitId;
      if (line.unitCost !== undefined) {
        update["unitCost"] = line.unitCost;
        const qty = line.quantity ?? "1";
        update["lineTotal"] = (parseFloat(qty) * parseFloat(line.unitCost)).toFixed(2);
      }
      if (line.matched !== undefined) update["matched"] = line.matched;
      else if (line.variantId !== undefined) update["matched"] = line.variantId !== null;

      if (Object.keys(update).length) {
        await db.update(purchaseOrderLinesTable).set(update)
          .where(and(eq(purchaseOrderLinesTable.id, line.id), eq(purchaseOrderLinesTable.purchaseOrderId, po.id)));
      }
    }

    const [updated] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, po.id));
    const lines = await db.select().from(purchaseOrderLinesTable).where(eq(purchaseOrderLinesTable.purchaseOrderId, po.id));
    res.json({ ...updated, lines });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
