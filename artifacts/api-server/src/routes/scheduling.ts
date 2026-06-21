import { Router } from "express";
import { db } from "@bizcore/db";
import {
  shiftsTable, employeesTable, employeeRolesTable, employeeDefaultShiftsTable,
} from "@bizcore/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireModule, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";
import { isLocationAllowed } from "../lib/access";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("scheduling")];

// Returns shifts enriched with employee name + role color for the calendar.
router.get("/shifts", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions = [];
    if (req.query["employeeId"]) conditions.push(eq(shiftsTable.employeeId, req.query["employeeId"] as string));
    if (req.query["locationId"]) conditions.push(eq(shiftsTable.locationId, req.query["locationId"] as string));
    if (req.query["from"]) conditions.push(gte(shiftsTable.startTime, new Date(req.query["from"] as string)));
    if (req.query["to"]) conditions.push(lte(shiftsTable.startTime, new Date(req.query["to"] as string)));

    const rows = await db
      .select({
        id: shiftsTable.id,
        employeeId: shiftsTable.employeeId,
        locationId: shiftsTable.locationId,
        startTime: shiftsTable.startTime,
        endTime: shiftsTable.endTime,
        notes: shiftsTable.notes,
        createdAt: shiftsTable.createdAt,
        employeeName: employeesTable.name,
        roleId: employeesTable.roleId,
        roleColor: employeeRolesTable.color,
        roleName: employeeRolesTable.name,
      })
      .from(shiftsTable)
      .leftJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
      .leftJoin(employeeRolesTable, eq(employeesTable.roleId, employeeRolesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(shiftsTable.startTime);

    // Tenant scope: only return shifts for employees of this business.
    const employeeIds = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(tenantWhere(employeesTable.businessId, businessId));
    const eidSet = new Set(employeeIds.map((e) => e.id));
    res.json(rows.filter((s) => eidSet.has(s.employeeId)));
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

router.post("/shifts", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, allowedLocationIds } = req as AuthedRequest;
  try {
    const body = shiftSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    if (!(await isLocationAllowed(db, businessId, allowedLocationIds, body.data.locationId))) { res.status(403).json({ error: "Location not allowed" }); return; }

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

router.patch("/shifts/:id", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = shiftSchema.partial().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db.select({ id: shiftsTable.id, employeeId: shiftsTable.employeeId }).from(shiftsTable)
      .where(eq(shiftsTable.id, req.params["id"] as string));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

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

router.delete("/shifts/:id", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
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

// Generate shifts for a full week from each employee's default schedule.
// utcOffsetMinutes: browser's getTimezoneOffset() value (e.g. 300 for UTC-5 Colombia).
// Skips days that already have a shift for that employee.
router.post("/shifts/generate-week", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = z.object({
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      utcOffsetMinutes: z.number().int().min(-840).max(840),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const employees = await db
      .select({ id: employeesTable.id, primaryLocationId: employeesTable.primaryLocationId })
      .from(employeesTable)
      .where(and(tenantWhere(employeesTable.businessId, businessId), eq(employeesTable.active, true)));

    if (!employees.length) { res.json({ created: 0, skipped: 0 }); return; }

    const empIds = employees.map((e) => e.id);
    const defaults = await db.select().from(employeeDefaultShiftsTable)
      .where(inArray(employeeDefaultShiftsTable.employeeId, empIds));

    if (!defaults.length) { res.json({ created: 0, skipped: 0 }); return; }

    const empMap = new Map(employees.map((e) => [e.id, e]));
    const defaultsByEmp = new Map<string, typeof defaults>();
    for (const d of defaults) {
      if (!defaultsByEmp.has(d.employeeId)) defaultsByEmp.set(d.employeeId, []);
      defaultsByEmp.get(d.employeeId)!.push(d);
    }

    // Week start midnight in local (Colombia) time expressed as UTC ms.
    // utcOffsetMinutes = 300 for UTC-5 → midnight local = 05:00 UTC.
    const weekStartMs = new Date(body.data.weekStart + "T00:00:00Z").getTime()
      + body.data.utcOffsetMinutes * 60_000;

    let created = 0, skipped = 0;

    for (const [empId, empDefaults] of defaultsByEmp) {
      const emp = empMap.get(empId);
      if (!emp?.primaryLocationId) { skipped += empDefaults.length; continue; }

      for (const ds of empDefaults) {
        // dayOfWeek: 0=Sun, 1=Mon, …, 6=Sat. weekStart is Monday → Mon=1 → offset 0, Sun=0 → offset 6.
        const dayOffset = ds.dayOfWeek === 0 ? 6 : ds.dayOfWeek - 1;
        const dayMs = dayOffset * 86_400_000;

        const [sh, sm] = ds.startTime.split(":").map(Number);
        const [eh, em] = ds.endTime.split(":").map(Number);
        const startTime = new Date(weekStartMs + dayMs + (sh! * 60 + sm!) * 60_000);
        const endTime   = new Date(weekStartMs + dayMs + (eh! * 60 + em!) * 60_000);

        // Skip if a shift already exists for this employee on this day.
        const dayStart = new Date(weekStartMs + dayMs);
        const dayEnd   = new Date(weekStartMs + dayMs + 86_400_000);
        const [existing] = await db.select({ id: shiftsTable.id }).from(shiftsTable)
          .where(and(
            eq(shiftsTable.employeeId, empId),
            gte(shiftsTable.startTime, dayStart),
            lte(shiftsTable.startTime, dayEnd),
          )).limit(1);

        if (existing) { skipped++; continue; }

        await db.insert(shiftsTable).values({
          employeeId: empId,
          locationId: emp.primaryLocationId,
          startTime,
          endTime,
        });
        created++;
      }
    }

    res.json({ created, skipped });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
