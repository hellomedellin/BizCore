import { Router } from "express";
import { db } from "@bizcore/db";
import {
  timeEntriesTable, timeOffRequestsTable,
  employeesTable,
} from "@bizcore/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireModule, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("time_tracking")];

// ─── Time Entries ─────────────────────────────────────────────────────────────

router.get("/time-entries", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions = [];
    if (req.query["employeeId"]) conditions.push(eq(timeEntriesTable.employeeId, req.query["employeeId"] as string));
    if (req.query["locationId"]) conditions.push(eq(timeEntriesTable.locationId, req.query["locationId"] as string));
    if (req.query["status"]) conditions.push(eq(timeEntriesTable.status, req.query["status"] as any));
    if (req.query["from"]) conditions.push(gte(timeEntriesTable.clockIn, new Date(req.query["from"] as string)));
    if (req.query["to"]) conditions.push(lte(timeEntriesTable.clockIn, new Date(req.query["to"] as string)));

    // Tenant scope via employees
    const employeeIds = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(tenantWhere(employeesTable.businessId, businessId));
    const eidSet = new Set(employeeIds.map((e) => e.id));

    let rows = await db.select().from(timeEntriesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(timeEntriesTable.clockIn));
    rows = rows.filter((e) => eidSet.has(e.employeeId));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createEntrySchema = z.object({
  employeeId: z.string().uuid(),
  locationId: z.string().uuid().nullable().optional(),
  shiftId: z.string().uuid().nullable().optional(),
  entryType: z.enum(["regular", "overtime", "sick", "vacation", "unpaid_leave", "holiday"]).default("regular"),
  clockIn: z.string(),
  clockOut: z.string().nullable().optional(),
  breakMinutes: z.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
});

router.post("/time-entries", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = createEntrySchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [employee] = await db.select().from(employeesTable)
      .where(and(eq(employeesTable.id, body.data.employeeId), tenantWhere(employeesTable.businessId, businessId)));
    if (!employee) { res.status(400).json({ error: "Employee not found" }); return; }

    const clockIn = new Date(body.data.clockIn);
    const clockOut = body.data.clockOut ? new Date(body.data.clockOut) : null;
    const totalMinutes = clockOut ? Math.max(0, Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000) - body.data.breakMinutes) : null;

    const [row] = await db.insert(timeEntriesTable).values({
      employeeId: employee.id,
      locationId: body.data.locationId ?? null,
      shiftId: body.data.shiftId ?? null,
      entryType: body.data.entryType,
      clockIn,
      clockOut,
      breakMinutes: body.data.breakMinutes,
      totalMinutes,
      hourlyRateSnapshot: employee.hourlyRate,
      overtimeRateSnapshot: employee.overtimeRateMultiplier,
      notes: body.data.notes ?? null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.patch("/time-entries/:id", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = createEntrySchema.partial().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.id, req.params["id"] as string));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(and(eq(employeesTable.id, existing.employeeId), tenantWhere(employeesTable.businessId, businessId)));
    if (!employee) { res.status(403).json({ error: "Forbidden" }); return; }

    const update: Record<string, unknown> = { ...body.data };
    if (body.data.clockIn) update["clockIn"] = new Date(body.data.clockIn);
    if (body.data.clockOut) update["clockOut"] = new Date(body.data.clockOut as string);

    const clockIn = update["clockIn"] ? (update["clockIn"] as Date) : existing.clockIn;
    const clockOut = update["clockOut"] ? (update["clockOut"] as Date) : existing.clockOut;
    const breakMinutes = (update["breakMinutes"] as number) ?? existing.breakMinutes;
    if (clockOut) update["totalMinutes"] = Math.max(0, Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000) - breakMinutes);

    const [row] = await db.update(timeEntriesTable).set(update).where(eq(timeEntriesTable.id, existing.id)).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Approve / reject a time entry
router.post("/time-entries/:id/review", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const body = z.object({ action: z.enum(["approve", "reject"]), rejectionReason: z.string().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db.select().from(timeEntriesTable).where(eq(timeEntriesTable.id, req.params["id"] as string));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(and(eq(employeesTable.id, existing.employeeId), tenantWhere(employeesTable.businessId, businessId)));
    if (!employee) { res.status(403).json({ error: "Forbidden" }); return; }

    const [row] = await db.update(timeEntriesTable).set({
      status: body.data.action === "approve" ? "approved" : "rejected",
      approvedBy: userId,
      approvedAt: new Date(),
      rejectionReason: body.data.rejectionReason ?? null,
    }).where(eq(timeEntriesTable.id, existing.id)).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// Bookkeeper CSV export — approved entries in date range
router.get("/time-entries/export", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    if (!req.query["from"] || !req.query["to"]) {
      res.status(400).json({ error: "from and to query params required" }); return;
    }

    const employeeRows = await db.select({ id: employeesTable.id, name: employeesTable.name, hourlyRate: employeesTable.hourlyRate })
      .from(employeesTable).where(tenantWhere(employeesTable.businessId, businessId));
    const eidMap = new Map(employeeRows.map((e) => [e.id, e]));

    const rows = await db.select().from(timeEntriesTable)
      .where(and(
        eq(timeEntriesTable.status, "approved"),
        gte(timeEntriesTable.clockIn, new Date(req.query["from"] as string)),
        lte(timeEntriesTable.clockIn, new Date(req.query["to"] as string)),
      )).orderBy(timeEntriesTable.clockIn);

    const tenantRows = rows.filter((r) => eidMap.has(r.employeeId));

    const header = "employee_name,entry_type,clock_in,clock_out,break_minutes,total_minutes,hourly_rate_snapshot,overtime_rate_snapshot\n";
    const lines = tenantRows.map((r) => {
      const emp = eidMap.get(r.employeeId);
      return [
        `"${emp?.name ?? r.employeeId}"`,
        r.entryType,
        r.clockIn.toISOString(),
        r.clockOut?.toISOString() ?? "",
        r.breakMinutes,
        r.totalMinutes ?? "",
        r.hourlyRateSnapshot ?? "",
        r.overtimeRateSnapshot ?? "",
      ].join(",");
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="time-entries-export.csv"`);
    res.send(header + lines.join("\n"));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── Time-Off Requests ────────────────────────────────────────────────────────

router.get("/time-off-requests", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions = [];
    if (req.query["employeeId"]) conditions.push(eq(timeOffRequestsTable.employeeId, req.query["employeeId"] as string));
    if (req.query["status"]) conditions.push(eq(timeOffRequestsTable.status, req.query["status"] as any));

    const employeeIds = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(tenantWhere(employeesTable.businessId, businessId));
    const eidSet = new Set(employeeIds.map((e) => e.id));

    let rows = await db.select().from(timeOffRequestsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(timeOffRequestsTable.createdAt));
    rows = rows.filter((r) => eidSet.has(r.employeeId));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.post("/time-off-requests/:id/review", ...guard, requireRole("owner", "admin", "manager"), async (req, res): Promise<void> => {
  const { businessId, userId } = req as AuthedRequest;
  try {
    const body = z.object({ action: z.enum(["approve", "reject"]), rejectionReason: z.string().optional() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db.select().from(timeOffRequestsTable).where(eq(timeOffRequestsTable.id, req.params["id"] as string));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable)
      .where(and(eq(employeesTable.id, existing.employeeId), tenantWhere(employeesTable.businessId, businessId)));
    if (!employee) { res.status(403).json({ error: "Forbidden" }); return; }

    const [row] = await db.update(timeOffRequestsTable).set({
      status: body.data.action === "approve" ? "approved" : "rejected",
      reviewedBy: userId,
      reviewedAt: new Date(),
      rejectionReason: body.data.rejectionReason ?? null,
    }).where(eq(timeOffRequestsTable.id, existing.id)).returning();
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
