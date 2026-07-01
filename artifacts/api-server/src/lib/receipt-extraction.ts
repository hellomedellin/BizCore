import Anthropic from "@anthropic-ai/sdk";

// Reads a photographed receipt / supplier invoice into structured line-item data
// using Claude vision. This is the single seam for the AI extraction — swap the
// model or provider here without touching the routes. Requires ANTHROPIC_API_KEY.

export interface ExtractedReceipt {
  supplierName: string | null;
  purchaseDate: string | null;
  taxId: string | null;
  currency: string | null;
  lines: { description: string; quantity: number; unit: string | null; unitCost: number }[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
}

export function isConfigured(): boolean {
  return !!process.env["ANTHROPIC_API_KEY"];
}

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };

// JSON schema the model must fill. Uses only the structured-output-supported
// subset (basic types, arrays, anyOf, additionalProperties:false).
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplierName: nullableString,
    purchaseDate: nullableString,
    taxId: nullableString,
    currency: nullableString,
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit: nullableString,
          unitCost: { type: "number" },
        },
        required: ["description", "quantity", "unit", "unitCost"],
      },
    },
    subtotal: nullableNumber,
    tax: nullableNumber,
    total: nullableNumber,
  },
  required: ["supplierName", "purchaseDate", "taxId", "currency", "lines", "subtotal", "tax", "total"],
};

const PROMPT =
  "This is a purchase receipt or supplier invoice for a restaurant. Extract its data into the required JSON schema. " +
  "Use null for any field that isn't present — some vendors have no tax ID, and that's fine, don't block on it. " +
  "Read each line item with its quantity, unit (kg, lb, ea, box…), and per-unit cost. " +
  "Amounts must be plain numbers with no currency symbols or thousands separators.";

export async function extractReceipt(dataBase64: string, mediaType: string): Promise<ExtractedReceipt> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const block =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: dataBase64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: dataBase64 } };

  const resp = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [block as any, { type: "text", text: PROMPT }],
      },
    ],
    // output_config is the canonical structured-output param; cast keeps this
    // compiling across SDK minor versions that don't yet type it.
    ...({ output_config: { format: { type: "json_schema", schema: RECEIPT_SCHEMA } } } as any),
  });

  let jsonText = "";
  for (const b of resp.content) if (b.type === "text") jsonText += b.text;
  if (!jsonText) throw new Error("No extraction returned");
  return JSON.parse(jsonText) as ExtractedReceipt;
}
