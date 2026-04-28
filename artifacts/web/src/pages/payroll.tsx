import { useState } from "react";
import {
  useGetPayroll,
  useGetEmployees,
  getGetPayrollQueryKey,
  getGetEmployeesQueryKey,
} from "@workspace/api-client-react";
import type { PayrollEntry } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, DollarSign, Clock, Users } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

function toISODate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function exportToCSV(entries: PayrollEntry[], startDate: string, endDate: string) {
  const headers = ["Employee", "Hours", "Hourly Rate", "Gross Pay", "Approved Entries"];
  const rows = entries.map((e) => [
    e.employeeName,
    e.totalHours.toFixed(2),
    `"${formatCurrency(parseFloat(e.hourlyRate))}"`,
    `"${formatCurrency(e.grossPay)}"`,
    e.entryCount,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll_${startDate}_to_${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PayrollPage() {
  const today = new Date();
  const [startDate, setStartDate] = useState(toISODate(startOfMonth(today)));
  const [endDate, setEndDate] = useState(toISODate(endOfMonth(today)));
  const [employeeId, setEmployeeId] = useState<string>("all");
  const [queryParams, setQueryParams] = useState<{ startDate: string; endDate: string; employeeId?: number } | null>(null);

  const empParams = {};
  const { data: employees } = useGetEmployees(empParams, {
    query: { queryKey: getGetEmployeesQueryKey(empParams) },
  });

  const { data: report, isLoading, error } = useGetPayroll(
    {
      startDate: queryParams?.startDate ?? startDate,
      endDate: queryParams?.endDate ?? endDate,
      ...(queryParams?.employeeId ? { employeeId: queryParams.employeeId } : {}),
    },
    {
      query: {
        enabled: queryParams !== null,
        queryKey: getGetPayrollQueryKey(queryParams ?? { startDate, endDate }),
      },
    }
  );

  const handleGenerate = () => {
    setQueryParams({
      startDate,
      endDate,
      ...(employeeId !== "all" ? { employeeId: parseInt(employeeId) } : {}),
    });
  };

  const totalGross = report?.entries.reduce((sum, e) => sum + e.grossPay, 0) ?? 0;
  const totalHours = report?.entries.reduce((sum, e) => sum + e.totalHours, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
        <p className="text-muted-foreground">Calculate gross pay from approved time entries</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="grid gap-1.5">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="grid gap-1.5 min-w-[180px]">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate}>Generate Report</Button>
              <Button
                variant="outline"
                onClick={() => {
                  const start = toISODate(subDays(today, 6));
                  const end = toISODate(today);
                  setStartDate(start);
                  setEndDate(end);
                  setQueryParams({ startDate: start, endDate: end });
                }}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const start = toISODate(startOfMonth(today));
                  const end = toISODate(endOfMonth(today));
                  setStartDate(start);
                  setEndDate(end);
                  setQueryParams({ startDate: start, endDate: end });
                }}
              >
                This month
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {queryParams && (
        <>
          {isLoading ? (
            <div className="grid gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : error ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                Failed to load payroll data.
              </CardContent>
            </Card>
          ) : report ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6 flex items-center gap-3">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Employees</p>
                      <p className="text-2xl font-bold">{report.entries.length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 flex items-center gap-3">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                      <p className="text-2xl font-bold">{totalHours.toFixed(1)}h</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 flex items-center gap-3">
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Gross Pay</p>
                      <p className="text-2xl font-bold">{formatCurrency(totalGross)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Breakdown</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(report.entries, report.startDate, report.endDate)}
                    disabled={report.entries.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {report.entries.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No approved time entries found for this period.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead className="text-right">Entries</TableHead>
                          <TableHead className="text-right">Total Time</TableHead>
                          <TableHead className="text-right">Hourly Rate</TableHead>
                          <TableHead className="text-right">Gross Pay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.entries.map((entry) => (
                          <TableRow key={entry.employeeId}>
                            <TableCell className="font-medium">{entry.employeeName}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{entry.entryCount}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatHours(entry.totalMinutes)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(parseFloat(entry.hourlyRate))}/hr
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatCurrency(entry.grossPay)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      )}

      {!queryParams && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
            Select a date range and click "Generate Report" to view payroll data.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
