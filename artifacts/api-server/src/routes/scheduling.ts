import { Router } from "express";
import { db } from "@bizcore/db";
import { shiftsTable, employeesTable } from "@bizcore/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireModule, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { isLocationAllowed } from "../lib/access";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("scheduling")];

router.get("/shifts", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions = [];
    if (req.query["employeeId"]) conditions.push(eq(shiftsTable.employeeId, req.query["employeeId"] as string));
    if (req.query["locationId"]) conditions.push(eq(shiftsTable.locationId, req.query["locationId"] as string));
    if (req.query["from"]) conditions.push(gte(shiftsTable.startTime, new Date(req.query["from"] as string)));
    if (req.query["to"]) conditions.push(lte(shiftsTable.endTime, new Date(req.query["to"] as string)));

    // Filter via employees join to ensure tenant scoping
    const employeeIds = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(tenantWhere(employeesTable.businessId, businessId));
    const eidSet = new Set(employeeIds.map((e) => e.id));

    let rows = await db.select().from(shiftsTable).where(conditions.length ? and(...conditions) : undefined)
      .orderBy(shiftsTable.startTime);
    rows = rows.filter((s) => eidSet.has(s.employeeId));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const shiftSchema = z.object({
  employeeId: z.string().uuid(),
  locationId: z.string().uuid(),
  startTime: z.string(),
  endTime: z.string(),
  notes: z.string().nullable().optional(),
});

router.post("/shifts", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = shiftSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

    // Confirm employee belongs to this business
    const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable).where(
      and(eq(employeesTable.id, body.data.employeeId), tenantWhere(employeesTable.businessId, businessId))
    );
    if (!employee) { res.status(400).json({ error: "Employee not found" }); return; }

    const [shift] = await db.insert(shiftsTable).values({
      ...body.data,
      startTime: new Date(body.data.startTime),
      endTime: new Date(body.data.endTime),
    }).returning();
    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.patch("/shifts/:id", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = shiftSchema.partial().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db.select({ id: shiftsTable.id, employeeId: shiftsTable.employeeId }).from(shiftsTable)
      .where(eq(shiftsTable.id, req.params["id"] as string));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    // Tenant check via employee
    const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(and(eq(employeesTable.id, existing.employeeId), tenantWhere(employeesTable.businessId, businessId)));
    if (!employee) { res.status(403).json({ error: "Forbidden" }); return; }

    const update: Record<string, unknown> = { ...body.data };
    if (body.data.startTime) update["startTime"] = new Date(body.data.startTime);
    if (body.data.endTime) update["endTime"] = new Date(body.data.endTime);

    const [row] = await db.update(shiftsTable).set(update).where(eq(shiftsTable.id, existing.id)).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.delete("/shifts/:id", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [existing] = await db.select({ id: shiftsTable.id, employeeId: shiftsTable.employeeId }).from(shiftsTable)
      .where(eq(shiftsTable.id, req.params["id"] as string));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(and(eq(employeesTable.id, existing.employeeId), tenantWhere(employeesTable.businessId, businessId)));
    if (!employee) { res.status(403).json({ error: "Forbidden" }); return; }

    await db.delete(shiftsTable).where(eq(shiftsTable.id, existing.id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
