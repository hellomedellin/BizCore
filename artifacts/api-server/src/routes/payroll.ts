import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { timeEntriesTable, employeesTable, locationsTable } from "@workspace/db/schema";
import { eq, and, gte, lte, SQL, inArray } from "drizzle-orm";
import {
  requireAuth,
  loadBusiness,
  requireRole,
  type AuthedRequest,
} from "../middlewares/auth";
import { tenantWhere, assertBusinessId } from "../lib/tenantScope";

const router: IRouter = Router();

router.get("/payroll", requireAuth, loadBusiness, requireRole("admin", "manager"), async (req, res): Promise<void> => {
  const authedReq = req as AuthedRequest;
  try {
    const businessId = assertBusinessId(authedReq.businessId);

    const { startDate, endDate, employeeId } = req.query;

    if (!startDate || !endDate || typeof startDate !== "string" || typeof endDate !== "string") {
      res.status(400).json({ error: "startDate and endDate are required (ISO date strings)" });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ error: "Invalid startDate or endDate" });
      return;
    }
    // Include the full end day
    end.setHours(23, 59, 59, 999);

    const conditions: SQL[] = [
      tenantWhere(employeesTable.businessId, businessId),
      eq(timeEntriesTable.status, "approved"),
      gte(timeEntriesTable.clockIn, start),
      lte(timeEntriesTable.clockIn, end),
    ];

    if (employeeId && typeof employeeId === "string") {
      const empId = parseInt(employeeId, 10);
      if (!isNaN(empId)) {
        conditions.push(eq(timeEntriesTable.employeeId, empId));
      }
    }

    const entries = await db
      .select({
        employeeId: timeEntriesTable.employeeId,
        employeeName: employeesTable.name,
        hourlyRate: employeesTable.hourlyRate,
        clockIn: timeEntriesTable.clockIn,
        clockOut: timeEntriesTable.clockOut,
      })
      .from(timeEntriesTable)
      .innerJoin(employeesTable, eq(timeEntriesTable.employeeId, employeesTable.id))
      .where(and(...conditions));

    // Aggregate per employee
    const empMap = new Map<number, {
      employeeId: number;
      employeeName: string;
      hourlyRate: string | null;
      totalMinutes: number;
      entryCount: number;
    }>();

    for (const entry of entries) {
      if (!entry.clockOut) continue; // Skip open entries
      const minutes = Math.round(
        (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 60000
      );
      if (!empMap.has(entry.employeeId)) {
        empMap.set(entry.employeeId, {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          hourlyRate: entry.hourlyRate,
          totalMinutes: 0,
          entryCount: 0,
        });
      }
      const rec = empMap.get(entry.employeeId)!;
      rec.totalMinutes += minutes;
      rec.entryCount += 1;
    }

    const result = Array.from(empMap.values()).map((rec) => {
      const totalHours = rec.totalMinutes / 60;
      const rate = rec.hourlyRate ? parseFloat(rec.hourlyRate) : 0;
      const grossPay = totalHours * rate;
      return {
        employeeId: rec.employeeId,
        employeeName: rec.employeeName,
        hourlyRate: rec.hourlyRate ?? "0",
        totalMinutes: rec.totalMinutes,
        totalHours: parseFloat(totalHours.toFixed(2)),
        grossPay: parseFloat(grossPay.toFixed(2)),
        entryCount: rec.entryCount,
      };
    });

    result.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    res.json({ startDate, endDate, entries: result });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500;
    res.status(status).json({ error: (err as Error).message });
  }
});

export default router;
