import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  shiftsTable,
  timeEntriesTable,
  employeesTable,
  locationsTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, lt, gt, SQL, sql } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

async function enrichShift(shiftId: number) {
  const [row] = await db
    .select({
      id: shiftsTable.id,
      employeeId: shiftsTable.employeeId,
      employeeName: employeesTable.name,
      locationId: shiftsTable.locationId,
      locationName: locationsTable.name,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      notes: shiftsTable.notes,
      createdAt: shiftsTable.createdAt,
    })
    .from(shiftsTable)
    .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(shiftsTable.locationId, locationsTable.id))
    .where(eq(shiftsTable.id, shiftId));
  return row;
}

async function detectConflict(
  employeeId: number,
  startTime: Date,
  endTime: Date,
  excludeShiftId?: number
): Promise<boolean> {
  const conditions: SQL[] = [
    eq(shiftsTable.employeeId, employeeId),
    lt(shiftsTable.startTime, endTime),
    gt(shiftsTable.endTime, startTime),
  ];
  if (excludeShiftId !== undefined) {
    conditions.push(sql`${shiftsTable.id} != ${excludeShiftId}`);
  }
  const conflicts = await db
    .select({ id: shiftsTable.id })
    .from(shiftsTable)
    .where(and(...conditions))
    .limit(1);
  return conflicts.length > 0;
}

async function enrichTimeEntry(entryId: number) {
  const [row] = await db
    .select({
      id: timeEntriesTable.id,
      employeeId: timeEntriesTable.employeeId,
      employeeName: employeesTable.name,
      locationId: timeEntriesTable.locationId,
      locationName: locationsTable.name,
      clockIn: timeEntriesTable.clockIn,
      clockOut: timeEntriesTable.clockOut,
      status: timeEntriesTable.status,
      approvedBy: timeEntriesTable.approvedBy,
      rejectionReason: timeEntriesTable.rejectionReason,
      notes: timeEntriesTable.notes,
      createdAt: timeEntriesTable.createdAt,
      updatedAt: timeEntriesTable.updatedAt,
    })
    .from(timeEntriesTable)
    .innerJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
    .leftJoin(locationsTable, eq(timeEntriesTable.locationId, locationsTable.id))
    .where(eq(timeEntriesTable.id, entryId));

  if (!row) return undefined;

  const durationMinutes =
    row.clockOut
      ? Math.round(
          (new Date(row.clockOut).getTime() - new Date(row.clockIn).getTime()) / 60000
        )
      : null;

  return { ...row, durationMinutes };
}

router.get("/shifts", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const conditions: SQL[] = [tenantWhere(employeesTable.businessId, businessId!)];

    if (req.query.locationId && !isNaN(parseInt(req.query.locationId as string))) {
      conditions.push(eq(shiftsTable.locationId, parseInt(req.query.locationId as string)));
    }
    if (req.query.employeeId && !isNaN(parseInt(req.query.employeeId as string))) {
      conditions.push(eq(shiftsTable.employeeId, parseInt(req.query.employeeId as string)));
    }
    if (req.query.from && typeof req.query.from === "string") {
      conditions.push(gte(shiftsTable.startTime, new Date(req.query.from)));
    }
    if (req.query.to && typeof req.query.to === "string") {
      conditions.push(lte(shiftsTable.startTime, new Date(req.query.to)));
    }

    const rows = await db
      .select({
        id: shiftsTable.id,
        employeeId: shiftsTable.employeeId,
        employeeName: employeesTable.name,
        locationId: shiftsTable.locationId,
        locationName: locationsTable.name,
        startTime: shiftsTable.startTime,
        endTime: shiftsTable.endTime,
        notes: shiftsTable.notes,
        createdAt: shiftsTable.createdAt,
      })
      .from(shiftsTable)
      .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
      .leftJoin(locationsTable, eq(shiftsTable.locationId, locationsTable.id))
      .where(and(...conditions))
      .orderBy(shiftsTable.startTime);

    const withConflicts = await Promise.all(
      rows.map(async (s) => ({
        ...s,
        hasConflict: await detectConflict(s.employeeId, new Date(s.startTime), new Date(s.endTime), s.id),
      }))
    );

    res.json(withConflicts);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createShiftSchema = z.object({
  employeeId: z.number().int(),
  locationId: z.number().int(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  notes: z.string().nullable().optional(),
});

router.post("/shifts", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const body = createShiftSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const { employeeId, locationId, startTime, endTime, notes } = body.data;

    if (new Date(startTime) >= new Date(endTime)) {
      res.status(400).json({ error: "Start time must be before end time" });
      return;
    }

    const [emp] = await db.select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), tenantWhere(employeesTable.businessId, businessId!)));
    if (!emp) { res.status(400).json({ error: "Employee not found" }); return; }

    const [loc] = await db.select({ id: locationsTable.id })
      .from(locationsTable)
      .where(and(eq(locationsTable.id, locationId), tenantWhere(locationsTable.businessId, businessId!)));
    if (!loc) { res.status(400).json({ error: "Location not found" }); return; }

    const [shift] = await db.insert(shiftsTable).values({
      employeeId,
      locationId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      notes: notes ?? null,
    }).returning();

    const row = await enrichShift(shift.id);
    if (!row) { res.status(500).json({ error: "Failed to retrieve created shift" }); return; }

    const hasConflict = await detectConflict(employeeId, new Date(startTime), new Date(endTime), shift.id);
    res.status(201).json({ ...row, hasConflict });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const updateShiftSchema = z.object({
  employeeId: z.number().int().optional(),
  locationId: z.number().int().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
});

router.patch("/shifts/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = updateShiftSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db
      .select({ id: shiftsTable.id, employeeId: shiftsTable.employeeId, startTime: shiftsTable.startTime, endTime: shiftsTable.endTime })
      .from(shiftsTable)
      .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
      .where(and(eq(shiftsTable.id, id), tenantWhere(employeesTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Shift not found" }); return; }

    const updates: Partial<{ employeeId: number; locationId: number; startTime: Date; endTime: Date; notes: string | null }> = {};
    if (body.data.employeeId !== undefined) updates.employeeId = body.data.employeeId;
    if (body.data.locationId !== undefined) updates.locationId = body.data.locationId;
    if (body.data.startTime !== undefined) updates.startTime = new Date(body.data.startTime);
    if (body.data.endTime !== undefined) updates.endTime = new Date(body.data.endTime);
    if (body.data.notes !== undefined) updates.notes = body.data.notes;

    const finalStart = updates.startTime ?? new Date(existing.startTime);
    const finalEnd = updates.endTime ?? new Date(existing.endTime);
    if (finalStart >= finalEnd) {
      res.status(400).json({ error: "Start time must be before end time" });
      return;
    }

    await db.update(shiftsTable).set(updates).where(eq(shiftsTable.id, id));

    const row = await enrichShift(id);
    if (!row) { res.status(500).json({ error: "Failed to retrieve updated shift" }); return; }

    const finalEmployeeId = updates.employeeId ?? existing.employeeId;
    const hasConflict = await detectConflict(finalEmployeeId, finalStart, finalEnd, id);
    res.json({ ...row, hasConflict });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.delete("/shifts/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [existing] = await db
      .select({ id: shiftsTable.id })
      .from(shiftsTable)
      .innerJoin(employeesTable, eq(shiftsTable.employeeId, employeesTable.id))
      .where(and(eq(shiftsTable.id, id), tenantWhere(employeesTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Shift not found" }); return; }

    await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
    res.status(204).send();
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/time-entries", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const conditions: SQL[] = [tenantWhere(employeesTable.businessId, businessId!)];

    if (req.query.employeeId && !isNaN(parseInt(req.query.employeeId as string))) {
      conditions.push(eq(timeEntriesTable.employeeId, parseInt(req.query.employeeId as string)));
    }
    if (req.query.locationId && !isNaN(parseInt(req.query.locationId as string))) {
      conditions.push(eq(timeEntriesTable.locationId, parseInt(req.query.locationId as string)));
    }
    if (req.query.status && typeof req.query.status === "string") {
      conditions.push(eq(timeEntriesTable.status, req.query.status));
    }
    if (req.query.from && typeof req.query.from === "string") {
      conditions.push(gte(timeEntriesTable.clockIn, new Date(req.query.from)));
    }
    if (req.query.to && typeof req.query.to === "string") {
      conditions.push(lte(timeEntriesTable.clockIn, new Date(req.query.to)));
    }

    const rows = await db
      .select({
        id: timeEntriesTable.id,
        employeeId: timeEntriesTable.employeeId,
        employeeName: employeesTable.name,
        locationId: timeEntriesTable.locationId,
        locationName: locationsTable.name,
        clockIn: timeEntriesTable.clockIn,
        clockOut: timeEntriesTable.clockOut,
        status: timeEntriesTable.status,
        approvedBy: timeEntriesTable.approvedBy,
        rejectionReason: timeEntriesTable.rejectionReason,
        notes: timeEntriesTable.notes,
        createdAt: timeEntriesTable.createdAt,
        updatedAt: timeEntriesTable.updatedAt,
      })
      .from(timeEntriesTable)
      .innerJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .leftJoin(locationsTable, eq(timeEntriesTable.locationId, locationsTable.id))
      .where(and(...conditions))
      .orderBy(sql`${timeEntriesTable.clockIn} DESC`);

    const withDuration = rows.map((r) => ({
      ...r,
      durationMinutes: r.clockOut
        ? Math.round((new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 60000)
        : null,
    }));

    res.json(withDuration);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const clockInSchema = z.object({
  employeeId: z.number().int(),
  locationId: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.post("/time-entries/clock-in", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const body = clockInSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const { employeeId, locationId, notes } = body.data;

    const [emp] = await db.select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), tenantWhere(employeesTable.businessId, businessId!)));
    if (!emp) { res.status(400).json({ error: "Employee not found" }); return; }

    const [open] = await db.select({ id: timeEntriesTable.id })
      .from(timeEntriesTable)
      .where(and(
        eq(timeEntriesTable.employeeId, employeeId),
        sql`${timeEntriesTable.clockOut} IS NULL`,
      ));
    if (open) { res.status(409).json({ error: "Employee is already clocked in" }); return; }

    const [entry] = await db.insert(timeEntriesTable).values({
      employeeId,
      locationId: locationId ?? null,
      clockIn: new Date(),
      status: "pending",
      notes: notes ?? null,
    }).returning();

    const row = await enrichTimeEntry(entry.id);
    res.status(201).json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const clockOutSchema = z.object({
  notes: z.string().nullable().optional(),
});

router.post("/time-entries/:id/clock-out", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = clockOutSchema.safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db
      .select({ id: timeEntriesTable.id, clockOut: timeEntriesTable.clockOut })
      .from(timeEntriesTable)
      .innerJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .where(and(eq(timeEntriesTable.id, id), tenantWhere(employeesTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Time entry not found" }); return; }
    if (existing.clockOut) { res.status(400).json({ error: "Already clocked out" }); return; }

    const updates: { clockOut: Date; notes?: string | null } = { clockOut: new Date() };
    if (body.data.notes !== undefined) updates.notes = body.data.notes;
    await db.update(timeEntriesTable).set(updates).where(eq(timeEntriesTable.id, id));

    const row = await enrichTimeEntry(id);
    res.json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const approveSchema = z.object({
  notes: z.string().nullable().optional(),
});

router.post("/time-entries/:id/approve", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = approveSchema.safeParse(req.body ?? {});
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db
      .select({ id: timeEntriesTable.id, clockOut: timeEntriesTable.clockOut, status: timeEntriesTable.status })
      .from(timeEntriesTable)
      .innerJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .where(and(eq(timeEntriesTable.id, id), tenantWhere(employeesTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Time entry not found" }); return; }
    if (!existing.clockOut) { res.status(400).json({ error: "Cannot approve an open time entry" }); return; }

    await db.update(timeEntriesTable).set({
      status: "approved",
      approvedBy: authedReq.userId,
      rejectionReason: null,
      ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
    }).where(eq(timeEntriesTable.id, id));

    const row = await enrichTimeEntry(id);
    res.json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const rejectSchema = z.object({
  reason: z.string().min(1),
});

router.post("/time-entries/:id/reject", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = rejectSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db
      .select({ id: timeEntriesTable.id, status: timeEntriesTable.status })
      .from(timeEntriesTable)
      .innerJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .where(and(eq(timeEntriesTable.id, id), tenantWhere(employeesTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Time entry not found" }); return; }

    await db.update(timeEntriesTable).set({
      status: "rejected",
      rejectionReason: body.data.reason,
      approvedBy: null,
    }).where(eq(timeEntriesTable.id, id));

    const row = await enrichTimeEntry(id);
    res.json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
