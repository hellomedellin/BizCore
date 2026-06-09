import { Router } from "express";
import { db } from "@bizcore/db";
import {
  employeesTable, timeEntriesTable, timeOffRequestsTable,
  shiftsTable, employeeRolesTable,
} from "@bizcore/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadEmployee, type AuthedRequest } from "../middlewares/auth";

// All routes here require employee auth (loadEmployee, not loadBusiness)
// They are mounted under /api/v1/me in app.ts

const router = Router();
const guard = [requireAuth, loadEmployee];

// My profile
router.get("/", ...guard, async (req, res): Promise<void> => {
  const { employeeId } = req as AuthedRequest;
  try {
    const [employee] = await db.select({
      id: employeesTable.id,
      name: employeesTable.name,
      email: employeesTable.email,
      phone: employeesTable.phone,
      roleId: employeesTable.roleId,
      primaryLocationId: employeesTable.primaryLocationId,
      hourlyRate: employeesTable.hourlyRate,
      overtimeRateMultiplier: employeesTable.overtimeRateMultiplier,
      active: employeesTable.active,
    }).from(employeesTable).where(eq(employeesTable.id, employeeId!));
    if (!employee) { res.status(404).json({ error: "Employee record not found" }); return; }

    let role = null;
    if (employee.roleId) {
      const [r] = await db.select({ name: employeeRolesTable.name }).from(employeeRolesTable).where(eq(employeeRolesTable.id, employee.roleId));
      role = r ?? null;
    }

    res.json({ ...employee, role });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Clock in
router.post("/clock-in", ...guard, async (req, res): Promise<void> => {
  const { employeeId } = req as AuthedRequest;
  try {
    const body = z.object({
      locationId: z.string().uuid().nullable().optional(),
      shiftId: z.string().uuid().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    // Check no open entry
    const open = await db.select({ id: timeEntriesTable.id }).from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.employeeId, employeeId!), eq(timeEntriesTable.status, "pending")))
      .limit(1);
    const hasOpen = open.some((e: { id: string }) => true);

    const [employee] = await db.select({ hourlyRate: employeesTable.hourlyRate, overtimeRateMultiplier: employeesTable.overtimeRateMultiplier })
      .from(employeesTable).where(eq(employeesTable.id, employeeId!));

    const [entry] = await db.insert(timeEntriesTable).values({
      employeeId: employeeId!,
      locationId: body.data.locationId ?? null,
      shiftId: body.data.shiftId ?? null,
      entryType: "regular",
      clockIn: new Date(),
      hourlyRateSnapshot: employee?.hourlyRate,
      overtimeRateSnapshot: employee?.overtimeRateMultiplier,
      notes: body.data.notes ?? null,
    }).returning();
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Clock out — finds the open entry (no clockOut) and closes it
router.post("/clock-out", ...guard, async (req, res): Promise<void> => {
  const { employeeId } = req as AuthedRequest;
  try {
    const body = z.object({ breakMinutes: z.number().int().min(0).default(0) }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [openEntry] = await db.select().from(timeEntriesTable)
      .where(and(eq(timeEntriesTable.employeeId, employeeId!)))
      .orderBy(desc(timeEntriesTable.clockIn))
      .limit(1);

    if (!openEntry || openEntry.clockOut) {
      res.status(400).json({ error: "No open time entry found" }); return;
    }

    const clockOut = new Date();
    const totalMinutes = Math.max(0, Math.floor((clockOut.getTime() - openEntry.clockIn.getTime()) / 60000) - body.data.breakMinutes);

    const [row] = await db.update(timeEntriesTable).set({
      clockOut,
      breakMinutes: body.data.breakMinutes,
      totalMinutes,
    }).where(eq(timeEntriesTable.id, openEntry.id)).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// My time entries (last 30 days by default)
router.get("/time-entries", ...guard, async (req, res): Promise<void> => {
  const { employeeId } = req as AuthedRequest;
  try {
    const conditions = [eq(timeEntriesTable.employeeId, employeeId!)];
    if (req.query["from"]) conditions.push(gte(timeEntriesTable.clockIn, new Date(req.query["from"] as string)));
    if (req.query["to"]) conditions.push(lte(timeEntriesTable.clockIn, new Date(req.query["to"] as string)));
    const rows = await db.select().from(timeEntriesTable).where(and(...conditions)).orderBy(desc(timeEntriesTable.clockIn)).limit(200);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// My upcoming shifts
router.get("/shifts", ...guard, async (req, res): Promise<void> => {
  const { employeeId } = req as AuthedRequest;
  try {
    const from = req.query["from"] ? new Date(req.query["from"] as string) : new Date();
    const conditions = [eq(shiftsTable.employeeId, employeeId!), gte(shiftsTable.startTime, from)];
    if (req.query["to"]) conditions.push(lte(shiftsTable.startTime, new Date(req.query["to"] as string)));
    const rows = await db.select().from(shiftsTable).where(and(...conditions)).orderBy(shiftsTable.startTime).limit(100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// My time-off requests
router.get("/time-off-requests", ...guard, async (req, res): Promise<void> => {
  const { employeeId } = req as AuthedRequest;
  try {
    const rows = await db.select().from(timeOffRequestsTable)
      .where(eq(timeOffRequestsTable.employeeId, employeeId!))
      .orderBy(desc(timeOffRequestsTable.createdAt)).limit(100);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Submit a time-off request
router.post("/time-off-requests", ...guard, async (req, res): Promise<void> => {
  const { employeeId } = req as AuthedRequest;
  try {
    const body = z.object({
      requestType: z.enum(["vacation", "sick", "personal", "unpaid"]),
      startDate: z.string(),
      endDate: z.string(),
      notes: z.string().nullable().optional(),
    }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [row] = await db.insert(timeOffRequestsTable).values({
      employeeId: employeeId!,
      ...body.data,
      notes: body.data.notes ?? null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
