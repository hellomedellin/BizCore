import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import logger from "./lib/logger";

// Routes
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import appUsersRouter from "./routes/app-users";
import businessesRouter from "./routes/businesses";
import locationsRouter from "./routes/locations";
import modulesRouter from "./routes/modules";
import usersRouter from "./routes/users";
import categoriesRouter from "./routes/categories";
import itemsRouter from "./routes/items";
import unitsRouter from "./routes/units";
import inventoryRouter from "./routes/inventory";
import consumptionProfilesRouter from "./routes/consumption-profiles";
import ordersRouter from "./routes/orders";
import customersRouter from "./routes/customers";
import employeesRouter from "./routes/employees";
import timeTrackingRouter from "./routes/time-tracking";
import schedulingRouter from "./routes/scheduling";
import timeOffRouter from "./routes/time-off";
import reportsRouter from "./routes/reports";
import suppliersRouter from "./routes/suppliers";
import purchasingRouter from "./routes/purchasing";
import invoiceAiRouter from "./routes/invoice-ai";
import apiKeysRouter from "./routes/api-keys";
import paymentsRouter from "./routes/payments";
import receiptsRouter from "./routes/receipts";
import siigoRouter from "./routes/siigo";
import meRouter from "./routes/me";

const app = express();

app.use(cors({
  origin: process.env["FRONTEND_URL"] ?? "http://localhost:5173",
  credentials: true,
}));

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/v1", healthRouter);
app.use("/api/v1", authRouter);
app.use("/api/v1", appUsersRouter);
app.use("/api/v1", businessesRouter);
app.use("/api/v1", locationsRouter);
app.use("/api/v1", modulesRouter);
app.use("/api/v1", usersRouter);
app.use("/api/v1", categoriesRouter);
app.use("/api/v1", itemsRouter);
app.use("/api/v1", unitsRouter);
app.use("/api/v1", inventoryRouter);
app.use("/api/v1", consumptionProfilesRouter);
app.use("/api/v1", ordersRouter);
app.use("/api/v1", customersRouter);
app.use("/api/v1", employeesRouter);
app.use("/api/v1", timeTrackingRouter);
app.use("/api/v1", schedulingRouter);
app.use("/api/v1", timeOffRouter);
app.use("/api/v1", reportsRouter);
app.use("/api/v1", suppliersRouter);
app.use("/api/v1", purchasingRouter);
app.use("/api/v1", invoiceAiRouter);
app.use("/api/v1", apiKeysRouter);
app.use("/api/v1", paymentsRouter);
app.use("/api/v1", receiptsRouter);
app.use("/api/v1", siigoRouter);
app.use("/api/v1/me", meRouter);

// Global error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error(err);
  res.status(500).json({ error: message });
});

export default app;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
// On first deploy (no app_users exist), auto-create the admin account from env vars.

import { db } from "@bizcore/db";
import { appUsersTable, businessesTable } from "@bizcore/db/schema";
import bcrypt from "bcryptjs";

export async function bootstrapAdminUser(): Promise<void> {
  const username = process.env["ADMIN_USERNAME"];
  const password = process.env["ADMIN_PASSWORD"];
  if (!username || !password) return;

  try {
    const existing = await db.select({ id: appUsersTable.id }).from(appUsersTable).limit(1);
    if (existing.length > 0) return; // already bootstrapped

    const [business] = await db.select({ id: businessesTable.id }).from(businessesTable).limit(1);
    if (!business) { console.warn("[bootstrap] No business found — skipping admin user creation"); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.insert(appUsersTable).values({
      businessId: business.id,
      username,
      passwordHash,
      role: "admin",
      displayName: "Admin",
    });
    console.log(`[bootstrap] Created admin user: ${username}`);
  } catch (err) {
    console.error("[bootstrap] Failed to create admin user:", err);
  }
}
