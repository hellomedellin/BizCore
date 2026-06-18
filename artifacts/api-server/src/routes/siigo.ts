import { Router } from "express";
import { db } from "@bizcore/db";
import {
  siigoConnectionsTable,
  ordersTable,
  orderLinesTable,
  orderStatusHistoryTable,
  paymentsTable,
  locationsTable,
} from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  requireAuth, loadBusiness, requireRole, type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import {
  getSiigoToken,
  getAllSiigoInvoices,
  mapSiigoPaymentMethod,
  toSiigoDate,
  type SiigoInvoice,
} from "../lib/siigo-client";

const router = Router();
const ownerAdmin = [requireAuth, loadBusiness, requireRole("admin")];

// ─── GET /siigo-connection ────────────────────────────────────────────────────

router.get("/siigo-connection", ...ownerAdmin, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [conn] = await db
      .select({ id: siigoConnectionsTable.id, username: siigoConnectionsTable.username, lastSyncAt: siigoConnectionsTable.lastSyncAt, active: siigoConnectionsTable.active, createdAt: siigoConnectionsTable.createdAt })
      .from(siigoConnectionsTable)
      .where(eq(siigoConnectionsTable.businessId, businessId))
      .limit(1);
    res.json(conn ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── PUT /siigo-connection ────────────────────────────────────────────────────

const siigoConnSchema = z.object({
  username: z.string().email("Debe ser un correo válido"),
  accessKey: z.string().min(1, "La llave de acceso es obligatoria"),
});

router.put("/siigo-connection", ...ownerAdmin, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = siigoConnSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    // Validate credentials immediately — fail fast before saving
    try {
      await getSiigoToken(body.data.username, body.data.accessKey);
    } catch (authErr) {
      res.status(422).json({ error: `Credenciales de Siigo inválidas: ${authErr instanceof Error ? authErr.message : "error de autenticación"}` });
      return;
    }

    const [conn] = await db
      .insert(siigoConnectionsTable)
      .values({ businessId, username: body.data.username, accessKey: body.data.accessKey })
      .onConflictDoUpdate({
        target: [siigoConnectionsTable.businessId],
        set: { username: body.data.username, accessKey: body.data.accessKey, active: true },
      })
      .returning();

    // Never return the accessKey in the response
    res.json({ id: conn!.id, username: conn!.username, lastSyncAt: conn!.lastSyncAt, active: conn!.active });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── DELETE /siigo-connection ─────────────────────────────────────────────────

router.delete("/siigo-connection", ...ownerAdmin, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    await db.delete(siigoConnectionsTable).where(eq(siigoConnectionsTable.businessId, businessId));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── POST /siigo-sync ─────────────────────────────────────────────────────────
// Pulls sales invoices from Siigo since lastSyncAt (default: last 30 days).
// For each new invoice: creates a completed BizCore order + payment record,
// stores the Siigo invoice number as externalRef and the DIAN CUFE on the order.

router.post("/siigo-sync", ...ownerAdmin, async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const [conn] = await db
      .select()
      .from(siigoConnectionsTable)
      .where(and(eq(siigoConnectionsTable.businessId, businessId), eq(siigoConnectionsTable.active, true)))
      .limit(1);

    if (!conn) {
      res.status(404).json({ error: "No hay una conexión Siigo activa configurada" });
      return;
    }

    // Resolve the default location for this business
    const [location] = await db
      .select({ id: locationsTable.id })
      .from(locationsTable)
      .where(and(tenantWhere(locationsTable.businessId, businessId), eq(locationsTable.active, true)))
      .limit(1);

    if (!location) {
      res.status(422).json({ error: "No hay ubicaciones activas — crea al menos una ubicación primero" });
      return;
    }

    // Date range: since last sync, or last 30 days
    const now = new Date();
    const from = conn.lastSyncAt ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateStart = toSiigoDate(from);
    const dateEnd = toSiigoDate(now);

    // Auth
    let token: string;
    try {
      token = await getSiigoToken(conn.username, conn.accessKey);
    } catch (authErr) {
      res.status(502).json({ error: `Error de autenticación con Siigo: ${authErr instanceof Error ? authErr.message : "desconocido"}` });
      return;
    }

    // Fetch invoices
    let invoices: SiigoInvoice[];
    try {
      invoices = await getAllSiigoInvoices(token, dateStart, dateEnd);
    } catch (fetchErr) {
      res.status(502).json({ error: `Error al obtener facturas de Siigo: ${fetchErr instanceof Error ? fetchErr.message : "desconocido"}` });
      return;
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const inv of invoices) {
      const siigoInvoiceId = String(inv.id);

      // Deduplication: skip if already imported
      const [existing] = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(and(
          tenantWhere(ordersTable.businessId, businessId),
          eq(ordersTable.siigoInvoiceId, siigoInvoiceId),
        ))
        .limit(1);

      if (existing) { skipped++; continue; }

      // Skip invoices with no items (void / draft)
      if (!inv.items || inv.items.length === 0) { skipped++; continue; }

      try {
        await db.transaction(async (tx) => {
          // Compute totals from invoice data
          const subtotal = String(inv.subtotal ?? inv.total);
          const taxTotal = inv.taxes?.reduce((s, t) => s + (t.total ?? 0), 0) ?? 0;
          const total = String(inv.total);

          // Derive order date from invoice date or metadata
          const orderDate = inv.date
            ? new Date(`${inv.date}T12:00:00Z`)
            : new Date(inv.metadata?.created ?? now);

          const [order] = await tx.insert(ordersTable).values({
            businessId,
            locationId: location.id,
            orderType: "retail",
            status: "completed",
            source: "api",
            externalRef: inv.number ?? siigoInvoiceId,
            siigoInvoiceId,
            cufe: inv.stamp?.cufe ?? null,
            notes: inv.observations || null,
            subtotal,
            discount: "0",
            tax: String(taxTotal),
            total,
            currencyCode: "COP",
            completedAt: orderDate,
            createdBy: "siigo_sync",
            createdAt: orderDate,
          }).returning();

          // Order lines
          const lineValues = inv.items.map((item) => ({
            orderId: order!.id,
            variantId: null,
            name: item.description ?? item.code,
            quantity: String(item.quantity),
            unitPrice: String(item.price ?? 0),
            lineTotal: String(item.total ?? (item.price ?? 0) * (item.quantity ?? 1)),
            notes: null,
            modifiers: null,
          }));
          if (lineValues.length) {
            await tx.insert(orderLinesTable).values(lineValues);
          }

          await tx.insert(orderStatusHistoryTable).values({
            orderId: order!.id,
            toStatus: "completed",
            changedBy: "siigo_sync",
            changedAt: orderDate,
          });

          // Payment — use first payment entry from Siigo if present
          const siigoPayment = inv.payments?.[0];
          const method = siigoPayment ? mapSiigoPaymentMethod(siigoPayment.name) : "other";
          const amount = siigoPayment ? String(siigoPayment.value) : total;

          await tx.insert(paymentsTable).values({
            orderId: order!.id,
            businessId,
            locationId: location.id,
            amount,
            tip: "0",
            currencyCode: "COP",
            method: method as any,
            status: "completed",
            externalTransactionId: siigoInvoiceId,
            posSource: "siigo_sync" as any,
            processedAt: orderDate,
            notes: `Factura Siigo ${inv.number ?? siigoInvoiceId}`,
            createdBy: "siigo_sync",
          });
        });
        imported++;
      } catch (e) {
        errors.push(`Factura ${inv.number ?? siigoInvoiceId}: ${e instanceof Error ? e.message : "error"}`);
      }
    }

    // Update lastSyncAt
    await db
      .update(siigoConnectionsTable)
      .set({ lastSyncAt: now })
      .where(eq(siigoConnectionsTable.id, conn.id));

    res.json({ imported, skipped, errors, syncedAt: now.toISOString() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
