import { Router } from "express";
import { db } from "@bizcore/db";
import { employeesTable, employeeRolesTable, employeeLocationsTable, employeeDefaultShiftsTable } from "@bizcore/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireModule, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("employees")];

// ─── Employee Roles ───────────────────────────────────────────────────────────

router.get("/employee-roles", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const rows = await db.select().from(employeeRolesTable)
      .where(tenantWhere(employeeRolesTable.businessId, businessId))
      .orderBy(employeeRolesTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const roleSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  hourlyRateDefault: z.string().nullable().optional(),
});

router.post("/employee-roles", ...guard, requireRole("admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = roleSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.insert(employeeRolesTable).values({ ...body.data, businessId }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.patch("/employee-roles/:id", ...guard, requireRole("admin"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = roleSchema.partial().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db.update(employeeRolesTable).set(body.data)
      .where(and(eq(employeeRolesTable.id, req.params["id"] as string), tenantWhere(employeeRolesTable.businessId, businessId)))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── Employees ────────────────────────────────────────────────────────────────

router.get("/employees", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const conditions = [tenantWhere(employeesTable.businessId, businessId)];
    if (req.query["search"]) conditions.push(ilike(employeesTable.name, `%${req.query["search"]}%`));
    // Default to active-only; pass ?active=false to include removed employees.
    conditions.push(eq(employeesTable.active, req.query["active"] === undefined ? true : req.query["active"] === "true"));
    if (req.query["roleId"]) conditions.push(eq(employeesTable.roleId, req.query["roleId"] as string));
    const rows = await db.select().from(employeesTable).where(and(...conditions)).orderBy(employeesTable.name);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const employeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  roleId: z.string().uuid().nullable().optional(),
  primaryLocationId: z.string().uuid().nullable().optional(),
  hourlyRate: z.string().nullable().optional(),
  overtimeRateMultiplier: z.string().optional(),
  active: z.boolean().optional(),
  locationIds: z.array(z.string().uuid()).optional(),
});

router.post("/employees", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = employeeSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const { locationIds, ...fields } = body.data;

    const [employee] = await db.insert(employeesTable).values({ ...fields, businessId }).returning();
    if (locationIds?.length) {
      await db.insert(employeeLocationsTable).values(locationIds.map((lid) => ({ employeeId: employee!.id, locationId: lid })));
    }
    res.status(201).json(employee);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/employees/:id", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [employee] = await db.select().from(employeesTable).where(
      and(eq(employeesTable.id, req.params["id"] as string), tenantWhere(employeesTable.businessId, businessId))
    );
    if (!employee) { res.status(404).json({ error: "Not found" }); return; }
    const locations = await db.select().from(employeeLocationsTable).where(eq(employeeLocationsTable.employeeId, employee.id));
    res.json({ ...employee, locations });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.patch("/employees/:id", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = employeeSchema.partial().safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const { locationIds, ...fields } = body.data;

    const [employee] = await db.update(employeesTable).set(fields)
      .where(and(eq(employeesTable.id, req.params["id"] as string), tenantWhere(employeesTable.businessId, businessId)))
      .returning();
    if (!employee) { res.status(404).json({ error: "Not found" }); return; }

    if (locationIds !== undefined) {
      await db.delete(employeeLocationsTable).where(eq(employeeLocationsTable.employeeId, employee.id));
      if (locationIds.length) {
        await db.insert(employeeLocationsTable).values(locationIds.map((lid) => ({ employeeId: employee.id, locationId: lid })));
      }
    }
    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── Default shifts ───────────────────────────────────────────────────────────

router.get("/employees/:id/default-shifts", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [emp] = await db.select({ id: employeesTable.id }).from(employeesTable).where(
      and(eq(employeesTable.id, req.params["id"] as string), tenantWhere(employeesTable.businessId, businessId))
    );
    if (!emp) { res.status(404).json({ error: "Not found" }); return; }
    const rows = await db.select().from(employeeDefaultShiftsTable)
      .where(eq(employeeDefaultShiftsTable.employeeId, emp.id))
      .orderBy(employeeDefaultShiftsTable.dayOfWeek);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const defaultShiftSchema = z.object({
  shifts: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })),
});

// PUT replaces all default shifts for the employee atomically.
router.put("/employees/:id/default-shifts", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [emp] = await db.select({ id: employeesTable.id }).from(employeesTable).where(
      and(eq(employeesTable.id, req.params["id"] as string), tenantWhere(employeesTable.businessId, businessId))
    );
    if (!emp) { res.status(404).json({ error: "Not found" }); return; }

    const body = defaultShiftSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    await db.delete(employeeDefaultShiftsTable).where(eq(employeeDefaultShiftsTable.employeeId, emp.id));
    if (body.data.shifts.length) {
      await db.insert(employeeDefaultShiftsTable).values(
        body.data.shifts.map((s) => ({ employeeId: emp.id, ...s }))
      );
    }
    const rows = await db.select().from(employeeDefaultShiftsTable)
      .where(eq(employeeDefaultShiftsTable.employeeId, emp.id))
      .orderBy(employeeDefaultShiftsTable.dayOfWeek);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
