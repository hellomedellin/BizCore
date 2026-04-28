import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { employeesTable, employeeRolesTable, locationsTable } from "@workspace/db/schema";
import { eq, and, ilike, SQL } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";
import { z } from "zod";

const router: IRouter = Router();

router.get("/employee-roles", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const rows = await db
      .select()
      .from(employeeRolesTable)
      .where(tenantWhere(employeeRolesTable.businessId, businessId!))
      .orderBy(employeeRolesTable.name);
    res.json(rows);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createRoleSchema = z.object({ name: z.string().min(1) });

router.post("/employee-roles", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const body = createRoleSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db
      .insert(employeeRolesTable)
      .values({ businessId: businessId!, name: body.data.name })
      .returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const updateRoleSchema = z.object({ name: z.string().min(1) });

router.patch("/employee-roles/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const body = updateRoleSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const [row] = await db
      .update(employeeRolesTable)
      .set({ name: body.data.name })
      .where(and(eq(employeeRolesTable.id, id), tenantWhere(employeeRolesTable.businessId, businessId!)))
      .returning();
    if (!row) { res.status(404).json({ error: "Role not found" }); return; }
    res.json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.delete("/employee-roles/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    await db
      .delete(employeeRolesTable)
      .where(and(eq(employeeRolesTable.id, id), tenantWhere(employeeRolesTable.businessId, businessId!)));
    res.status(204).send();
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/employees", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);

    const conditions: SQL[] = [tenantWhere(employeesTable.businessId, businessId!)];

    if (req.query.search && typeof req.query.search === "string" && req.query.search.trim()) {
      conditions.push(ilike(employeesTable.name, `%${req.query.search.trim()}%`));
    }
    if (req.query.locationId && !isNaN(parseInt(req.query.locationId as string))) {
      conditions.push(eq(employeesTable.locationId, parseInt(req.query.locationId as string)));
    }
    if (req.query.roleId && !isNaN(parseInt(req.query.roleId as string))) {
      conditions.push(eq(employeesTable.roleId, parseInt(req.query.roleId as string)));
    }
    if (req.query.active !== undefined) {
      conditions.push(eq(employeesTable.active, req.query.active === "true"));
    }

    const rows = await db
      .select({
        id: employeesTable.id,
        businessId: employeesTable.businessId,
        name: employeesTable.name,
        email: employeesTable.email,
        phone: employeesTable.phone,
        roleId: employeesTable.roleId,
        roleName: employeeRolesTable.name,
        locationId: employeesTable.locationId,
        locationName: locationsTable.name,
        hourlyRate: employeesTable.hourlyRate,
        active: employeesTable.active,
        createdAt: employeesTable.createdAt,
        updatedAt: employeesTable.updatedAt,
      })
      .from(employeesTable)
      .leftJoin(employeeRolesTable, eq(employeesTable.roleId, employeeRolesTable.id))
      .leftJoin(locationsTable, eq(employeesTable.locationId, locationsTable.id))
      .where(and(...conditions))
      .orderBy(employeesTable.name);

    res.json(rows);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const createEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  roleId: z.number().int().nullable().optional(),
  locationId: z.number().int().nullable().optional(),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),
});

router.post("/employees", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const body = createEmployeeSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    if (body.data.roleId != null) {
      const [role] = await db.select({ id: employeeRolesTable.id })
        .from(employeeRolesTable)
        .where(and(eq(employeeRolesTable.id, body.data.roleId), tenantWhere(employeeRolesTable.businessId, businessId!)));
      if (!role) { res.status(400).json({ error: "Employee role not found" }); return; }
    }
    if (body.data.locationId != null) {
      const [loc] = await db.select({ id: locationsTable.id })
        .from(locationsTable)
        .where(and(eq(locationsTable.id, body.data.locationId), tenantWhere(locationsTable.businessId, businessId!)));
      if (!loc) { res.status(400).json({ error: "Location not found" }); return; }
    }

    const [emp] = await db
      .insert(employeesTable)
      .values({ businessId: businessId!, ...body.data })
      .returning();

    const [row] = await db
      .select({
        id: employeesTable.id,
        businessId: employeesTable.businessId,
        name: employeesTable.name,
        email: employeesTable.email,
        phone: employeesTable.phone,
        roleId: employeesTable.roleId,
        roleName: employeeRolesTable.name,
        locationId: employeesTable.locationId,
        locationName: locationsTable.name,
        hourlyRate: employeesTable.hourlyRate,
        active: employeesTable.active,
        createdAt: employeesTable.createdAt,
        updatedAt: employeesTable.updatedAt,
      })
      .from(employeesTable)
      .leftJoin(employeeRolesTable, eq(employeesTable.roleId, employeeRolesTable.id))
      .leftJoin(locationsTable, eq(employeesTable.locationId, locationsTable.id))
      .where(eq(employeesTable.id, emp.id));

    res.status(201).json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.get("/employees/:id", requireAuth, loadBusiness, async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [row] = await db
      .select({
        id: employeesTable.id,
        businessId: employeesTable.businessId,
        name: employeesTable.name,
        email: employeesTable.email,
        phone: employeesTable.phone,
        roleId: employeesTable.roleId,
        roleName: employeeRolesTable.name,
        locationId: employeesTable.locationId,
        locationName: locationsTable.name,
        hourlyRate: employeesTable.hourlyRate,
        active: employeesTable.active,
        createdAt: employeesTable.createdAt,
        updatedAt: employeesTable.updatedAt,
      })
      .from(employeesTable)
      .leftJoin(employeeRolesTable, eq(employeesTable.roleId, employeeRolesTable.id))
      .leftJoin(locationsTable, eq(employeesTable.locationId, locationsTable.id))
      .where(and(eq(employeesTable.id, id), tenantWhere(employeesTable.businessId, businessId!)));

    if (!row) { res.status(404).json({ error: "Employee not found" }); return; }
    res.json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  roleId: z.number().int().nullable().optional(),
  locationId: z.number().int().nullable().optional(),
  hourlyRate: z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional(),
  active: z.boolean().optional(),
});

router.patch("/employees/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const body = updateEmployeeSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

    const [existing] = await db.select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.id, id), tenantWhere(employeesTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Employee not found" }); return; }

    if (body.data.roleId != null) {
      const [role] = await db.select({ id: employeeRolesTable.id })
        .from(employeeRolesTable)
        .where(and(eq(employeeRolesTable.id, body.data.roleId), tenantWhere(employeeRolesTable.businessId, businessId!)));
      if (!role) { res.status(400).json({ error: "Employee role not found" }); return; }
    }
    if (body.data.locationId != null) {
      const [loc] = await db.select({ id: locationsTable.id })
        .from(locationsTable)
        .where(and(eq(locationsTable.id, body.data.locationId), tenantWhere(locationsTable.businessId, businessId!)));
      if (!loc) { res.status(400).json({ error: "Location not found" }); return; }
    }

    await db.update(employeesTable).set(body.data).where(eq(employeesTable.id, id));

    const [row] = await db
      .select({
        id: employeesTable.id,
        businessId: employeesTable.businessId,
        name: employeesTable.name,
        email: employeesTable.email,
        phone: employeesTable.phone,
        roleId: employeesTable.roleId,
        roleName: employeeRolesTable.name,
        locationId: employeesTable.locationId,
        locationName: locationsTable.name,
        hourlyRate: employeesTable.hourlyRate,
        active: employeesTable.active,
        createdAt: employeesTable.createdAt,
        updatedAt: employeesTable.updatedAt,
      })
      .from(employeesTable)
      .leftJoin(employeeRolesTable, eq(employeesTable.roleId, employeeRolesTable.id))
      .leftJoin(locationsTable, eq(employeesTable.locationId, locationsTable.id))
      .where(eq(employeesTable.id, id));

    res.json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

router.delete("/employees/:id", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = authedReq.businessId;
    assertBusinessId(businessId);
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [existing] = await db.select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.id, id), tenantWhere(employeesTable.businessId, businessId!)));
    if (!existing) { res.status(404).json({ error: "Employee not found" }); return; }

    await db.update(employeesTable).set({ active: false }).where(eq(employeesTable.id, id));

    const [row] = await db
      .select({
        id: employeesTable.id,
        businessId: employeesTable.businessId,
        name: employeesTable.name,
        email: employeesTable.email,
        phone: employeesTable.phone,
        roleId: employeesTable.roleId,
        roleName: employeeRolesTable.name,
        locationId: employeesTable.locationId,
        locationName: locationsTable.name,
        hourlyRate: employeesTable.hourlyRate,
        active: employeesTable.active,
        createdAt: employeesTable.createdAt,
        updatedAt: employeesTable.updatedAt,
      })
      .from(employeesTable)
      .leftJoin(employeeRolesTable, eq(employeesTable.roleId, employeeRolesTable.id))
      .leftJoin(locationsTable, eq(employeesTable.locationId, locationsTable.id))
      .where(eq(employeesTable.id, id));

    res.json(row);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
