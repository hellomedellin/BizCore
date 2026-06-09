/**
 * Lambda — Invoice AI Processor
 *
 * Triggered by SQS. Fetches invoice from S3, sends to Claude API for extraction,
 * writes AI-extracted lines back to purchase_order_lines, updates PO status.
 */

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function handler(event) {
  for (const record of event.Records) {
    const { purchaseOrderId, businessId, s3Key } = JSON.parse(record.body);

    try {
      // Fetch the invoice from S3
      const s3Obj = await s3.send(new GetObjectCommand({
        Bucket: process.env.INVOICE_BUCKET,
        Key: s3Key,
      }));
      const bytes = await s3Obj.Body.transformToByteArray();
      const base64 = Buffer.from(bytes).toString("base64");
      const contentType = s3Obj.ContentType ?? "application/pdf";

      // Call Claude to extract invoice data
      const message = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: contentType, data: base64 },
            },
            {
              type: "text",
              text: `Extract all line items from this supplier invoice. Return a JSON array of objects with these exact fields:
{
  "description": "item description",
  "quantity": "numeric string",
  "unitCost": "numeric string (unit price)",
  "lineTotal": "numeric string",
  "unit": "unit name if present (e.g. kg, L, each)"
}

Return ONLY valid JSON, no markdown, no explanation.`,
            },
          ],
        }],
      });

      let lines = [];
      try {
        const text = message.content[0].type === "text" ? message.content[0].text : "[]";
        lines = JSON.parse(text);
      } catch {
        console.error("Failed to parse Claude response", message.content[0]);
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Insert extracted lines
        for (const line of lines) {
          await client.query(
            `INSERT INTO purchase_order_lines (purchase_order_id, description, quantity, unit_cost, line_total, matched)
             VALUES ($1, $2, $3, $4, $5, false)`,
            [purchaseOrderId, line.description ?? "", line.quantity ?? "1", line.unitCost ?? "0", line.lineTotal ?? "0"]
          );
        }

        // Mark PO as ai_complete
        await client.query(
          `UPDATE purchase_orders SET status = 'ai_complete', updated_at = NOW() WHERE id = $1`,
          [purchaseOrderId]
        );

        await client.query("COMMIT");
        console.log(`Processed PO ${purchaseOrderId}: ${lines.length} lines extracted`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error(`Failed to process PO ${purchaseOrderId}:`, err);
      // Re-throw to trigger SQS retry / DLQ
      throw err;
    }
  }
}
