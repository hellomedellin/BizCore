import { Router } from "express";
import { db } from "@bizcore/db";
import { timeOffRequestsTable, employeesTable } from "@bizcore/db/schema";
import { eq, and, lte, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, loadBusiness, requireModule, requireRole, type AuthedRequest } from "../middlewares/auth";
import { tenantWhere } from "../lib/tenant";

const router = Router();
const guard = [requireAuth, loadBusiness, requireModule("scheduling")];

// GET /time-off-requests?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns approved requests whose date range overlaps the given window.
router.get("/time-off-requests", ...guard, async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const employees = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(tenantWhere(employeesTable.businessId, businessId));

    const empIds = employees.map((e) => e.id);
    if (!empIds.length) { res.json([]); return; }

    const conditions: ReturnType<typeof eq>[] = [
      inArray(timeOffRequestsTable.employeeId, empIds),
      eq(timeOffRequestsTable.status, "approved"),
    ];
    // Overlap: startDate <= queryTo  AND  endDate >= queryFrom
    if (req.query["from"]) conditions.push(gte(timeOffRequestsTable.endDate, req.query["from"] as string));
    if (req.query["to"])   conditions.push(lte(timeOffRequestsTable.startDate, req.query["to"] as string));

    const rows = await db
      .select()
      .from(timeOffRequestsTable)
      .where(and(...conditions))
      .orderBy(timeOffRequestsTable.startDate);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

const timeOffSchema = z.object({
  employeeId:  z.string().uuid(),
  requestType: z.enum(["vacation", "sick", "personal", "unpaid"]),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes:       z.string().nullable().optional(),
});

// POST /time-off-requests — admin/manager entry = auto-approved
router.post("/time-off-requests", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const body = timeOffSchema.safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: body.error.errors[0]?.message }); return; }

    const [emp] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.id, body.data.employeeId), tenantWhere(employeesTable.businessId, businessId)));
    if (!emp) { res.status(400).json({ error: "Employee not found" }); return; }

    const [row] = await db
      .insert(timeOffRequestsTable)
      .values({ ...body.data, status: "approved" })
      .returning();

    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// DELETE /time-off-requests/:id
router.delete("/time-off-requests/:id", ...guard, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const { businessId } = req as AuthedRequest;
  try {
    const [request] = await db
      .select({ id: timeOffRequestsTable.id, employeeId: timeOffRequestsTable.employeeId })
      .from(timeOffRequestsTable)
      .where(eq(timeOffRequestsTable.id, req.params["id"] as string));
    if (!request) { res.status(404).json({ error: "Not found" }); return; }

    const [emp] = await db
      .select({ id: employeesTable.id })
      .from(employeesTable)
      .where(and(eq(employeesTable.id, request.employeeId), tenantWhere(employeesTable.businessId, businessId)));
    if (!emp) { res.status(403).json({ error: "Forbidden" }); return; }

    await db.delete(timeOffRequestsTable).where(eq(timeOffRequestsTable.id, request.id));
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
