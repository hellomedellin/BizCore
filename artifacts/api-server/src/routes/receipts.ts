import { Router } from "express";
import { db } from "@bizcore/db";
import {
  ordersTable,
  orderLinesTable,
  paymentsTable,
  businessesTable,
} from "@bizcore/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, loadBusiness, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  other: "Otro",
};

const ORDER_TYPE_LABEL: Record<string, string> = {
  dine_in: "Mesa",
  pickup: "Para llevar",
  delivery: "Domicilio",
  retail: "Mostrador",
  service: "Servicio",
};

function formatMoney(amount: string | number, currency = "USD") {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "COP" ? 0 : 2,
      maximumFractionDigits: currency === "COP" ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  });
}

router.get("/receipts/:orderId", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, req.params["orderId"] as string), tenantWhere(ordersTable.businessId, businessId)))
      .limit(1);

    if (!order) { res.status(404).send("Order not found"); return; }

    const [business] = await db
      .select({ name: businessesTable.name, address: businessesTable.address, phone: businessesTable.phone })
      .from(businessesTable)
      .where(eq(businessesTable.id, businessId))
      .limit(1);

    const lines = await db.select().from(orderLinesTable).where(eq(orderLinesTable.orderId, order.id));

    const payments = await db
      .select()
      .from(paymentsTable)
      .where(and(eq(paymentsTable.orderId, order.id), tenantWhere(paymentsTable.businessId, businessId)));

    const payment = payments[0];
    const tip = payment ? parseFloat(payment.tip) : 0;
    const amountPaid = payment ? parseFloat(payment.amount) : 0;
    const total = parseFloat(order.total);
    const change = Math.max(0, amountPaid - total - tip);

    // Short order number for the receipt (last 8 chars of UUID).
    const orderNum = order.id.slice(-8).toUpperCase();
    const cur = order.currencyCode;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Recibo #${orderNum}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 13px; color: #111; background: #fff; padding: 16px; max-width: 320px; margin: 0 auto; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-top: 1px dashed #999; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin: 4px 0; }
    .footer { text-align: center; margin-top: 16px; font-size: 12px; color: #555; }
    @media print {
      body { padding: 0; }
      @page { margin: 8mm; }
    }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:15px;">${business?.name ?? "Restaurante"}</div>
  ${business?.address ? `<div class="center" style="font-size:11px;color:#555;">${business.address}</div>` : ""}
  ${business?.phone ? `<div class="center" style="font-size:11px;color:#555;">Tel: ${business.phone}</div>` : ""}

  <div class="divider"></div>

  <div class="row">
    <span>Recibo #${orderNum}</span>
    <span>${ORDER_TYPE_LABEL[order.orderType] ?? order.orderType}</span>
  </div>
  <div class="row">
    <span>${formatDate(order.createdAt)}</span>
  </div>

  <div class="divider"></div>

  ${lines.map((l) => `
  <div class="row">
    <span>${parseFloat(l.quantity) % 1 === 0 ? parseInt(l.quantity) : parseFloat(l.quantity)}x ${l.name}</span>
    <span>${formatMoney(l.lineTotal, cur)}</span>
  </div>`).join("")}

  <div class="divider"></div>

  <div class="row"><span>Subtotal</span><span>${formatMoney(order.subtotal, cur)}</span></div>
  ${parseFloat(order.discount) > 0 ? `<div class="row"><span>Descuento</span><span>-${formatMoney(order.discount, cur)}</span></div>` : ""}
  ${parseFloat(order.tax) > 0 ? `<div class="row"><span>Impuesto</span><span>${formatMoney(order.tax, cur)}</span></div>` : ""}
  ${tip > 0 ? `<div class="row"><span>Propina (10%)</span><span>${formatMoney(tip, cur)}</span></div>` : ""}

  <div class="divider"></div>
  <div class="total-row"><span>TOTAL</span><span>${formatMoney(total + tip, cur)}</span></div>

  ${payment ? `
  <div class="divider"></div>
  <div class="row"><span>Pago: ${METHOD_LABEL[payment.method] ?? payment.method}</span><span>${formatMoney(amountPaid, cur)}</span></div>
  ${change > 0 ? `<div class="row"><span>Cambio</span><span>${formatMoney(change, cur)}</span></div>` : ""}
  ` : ""}

  <div class="footer">
    ¡Gracias por su visita!
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    res.status(500).send("Error generating receipt");
  }
});

export default router;
