import express from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { clerkMiddleware } from "./middlewares/auth";
import logger from "./lib/logger";

// Routes
import healthRouter from "./routes/health";
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
import suppliersRouter from "./routes/suppliers";
import purchasingRouter from "./routes/purchasing";
import invoiceAiRouter from "./routes/invoice-ai";
import apiKeysRouter from "./routes/api-keys";
import meRouter from "./routes/me";

const app = express();

app.use(cors({
  origin: process.env["FRONTEND_URL"] ?? "http://localhost:5173",
  credentials: true,
}));

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "10mb" }));
app.use(clerkMiddleware());

// Routes
app.use("/api/v1", healthRouter);
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
app.use("/api/v1", suppliersRouter);
app.use("/api/v1", purchasingRouter);
app.use("/api/v1", invoiceAiRouter);
app.use("/api/v1", apiKeysRouter);
app.use("/api/v1/me", meRouter);

// Global error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  logger.error(err);
  res.status(500).json({ error: message });
});

export default app;
