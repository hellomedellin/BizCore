import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetEmployees,
  useGetEmployeeRoles,
  useGetLocations,
  useCreateEmployee,
  useUpdateEmployee,
  useDeactivateEmployee,
  useCreateEmployeeRole,
  useUpdateEmployeeRole,
  useDeleteEmployeeRole,
  getGetEmployeesQueryKey,
  getGetEmployeeRolesQueryKey,
} from "@workspace/api-client-react";
import type {
  Employee,
  EmployeeRole,
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useEntityCustomFields } from "@/components/use-entity-custom-fields";
import { CustomFieldsSection, CustomFieldsReadView } from "@/components/custom-fields-section";
import {
  Users,
  Plus,
  MoreHorizontal,
  Search,
  Pencil,
  Trash2,
  Tag,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  FolderOpen,
} from "lucide-react";

type EmployeeFormData = {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  locationId: string;
  hourlyRate: string;
};

const EMPTY_FORM: EmployeeFormData = {
  name: "",
  email: "",
  phone: "",
  roleId: "none",
  locationId: "none",
  hourlyRate: "",
};

function employeeToForm(emp: Employee): EmployeeFormData {
  return {
    name: emp.name,
    email: emp.email ?? "",
    phone: emp.phone ?? "",
    roleId: emp.roleId?.toString() ?? "none",
    locationId: emp.locationId?.toString() ?? "none",
    hourlyRate: emp.hourlyRate ?? "",
  };
}

function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  roles,
  locations,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee?: Employee;
  roles: EmployeeRole[];
  locations: { id: number; name: string }[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<EmployeeFormData>(
    employee ? employeeToForm(employee) : EMPTY_FORM
  );
  const { toast } = useToast();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const isEditing = !!employee;

  const { fields: cfFields, values: cfValues, setFieldValue: cfSet, save: cfSave, reset: cfReset } =
    useEntityCustomFields("employee", employee?.id);

  useEffect(() => {
    if (open) {
      setForm(employee ? employeeToForm(employee) : EMPTY_FORM);
    } else {
      cfReset();
    }
  }, [open]);

  const set = (key: keyof EmployeeFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload: CreateEmployeeBody | UpdateEmployeeBody = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      roleId: form.roleId !== "none" ? parseInt(form.roleId) : null,
      locationId: form.locationId !== "none" ? parseInt(form.locationId) : null,
      hourlyRate: form.hourlyRate.trim() || null,
    };
    try {
      let entityId: number;
      if (isEditing) {
        await updateEmployee.mutateAsync({ id: employee!.id, data: payload as UpdateEmployeeBody });
        entityId = employee!.id;
        toast({ title: "Employee updated" });
      } else {
        const created = await createEmployee.mutateAsync({ data: payload as CreateEmployeeBody });
        entityId = created.id;
        toast({ title: "Employee created" });
      }
      onSuccess();
      onOpenChange(false);
      // Save custom fields after closing — non-fatal if it fails
      if (cfFields.length > 0) {
        cfSave(entityId).catch(() => {
          toast({ title: "Employee saved, but custom field values could not be saved", variant: "destructive" });
        });
      }
    } catch {
      toast({ title: "Error saving employee", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Employee" : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Full Name *</Label>
            <Input
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. Jordan Smith"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="jordan@example.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={set("phone")}
                placeholder="+1 555 0100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select
                value={form.roleId}
                onValueChange={(v) => setForm((f) => ({ ...f, roleId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Location</Label>
              <Select
                value={form.locationId}
                onValueChange={(v) => setForm((f) => ({ ...f, locationId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No location</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id.toString()}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Hourly Rate ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.hourlyRate}
              onChange={set("hourlyRate")}
              placeholder="e.g. 15.00"
            />
          </div>
          <CustomFieldsSection
            fields={cfFields}
            values={cfValues}
            onChange={cfSet}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createEmployee.isPending || updateEmployee.isPending}
          >
            {isEditing ? "Save Changes" : "Create Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDetailSheet({
  open,
  onOpenChange,
  employee,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee;
  onEdit: () => void;
}) {
  const { fields: cfFields, values: cfValues } = useEntityCustomFields(
    "employee",
    open ? employee?.id : undefined
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Employee Profile
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{employee.name}</h2>
              <Badge
                variant={employee.active ? "default" : "secondary"}
                className="mt-1"
              >
                {employee.active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
            </Button>
          </div>

          <div className="grid gap-3">
            {employee.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{employee.email}</span>
              </div>
            )}
            {employee.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{employee.phone}</span>
              </div>
            )}
            {employee.roleName && (
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{employee.roleName}</span>
              </div>
            )}
            {employee.locationName && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{employee.locationName}</span>
              </div>
            )}
            {employee.hourlyRate && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>${parseFloat(employee.hourlyRate).toFixed(2)} / hr</span>
              </div>
            )}
          </div>

          <CustomFieldsReadView fields={cfFields} values={cfValues} />

          <div className="rounded-md border border-dashed p-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Schedule & Time Tracking</p>
            <p className="text-xs text-muted-foreground">
              Shift schedules and time entries will appear here once the scheduling module is enabled.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RolesManagerSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roles, isLoading } = useGetEmployeeRoles();
  const createRole = useCreateEmployeeRole();
  const updateRole = useUpdateEmployeeRole();
  const deleteRole = useDeleteEmployeeRole();

  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    role?: EmployeeRole;
    name: string;
  }>({ open: false, name: "" });

  const invalidateRoles = () =>
    queryClient.invalidateQueries({ queryKey: getGetEmployeeRolesQueryKey() });

  const handleSave = async () => {
    if (!roleDialog.name.trim()) {
      toast({ title: "Role name is required", variant: "destructive" });
      return;
    }
    try {
      if (roleDialog.role) {
        await updateRole.mutateAsync({ id: roleDialog.role.id, data: { name: roleDialog.name.trim() } });
        toast({ title: "Role updated" });
      } else {
        await createRole.mutateAsync({ data: { name: roleDialog.name.trim() } });
        toast({ title: "Role created" });
      }
      invalidateRoles();
      setRoleDialog({ open: false, name: "" });
    } catch {
      toast({ title: "Error saving role", variant: "destructive" });
    }
  };

  const handleDelete = async (role: EmployeeRole) => {
    try {
      await deleteRole.mutateAsync({ id: role.id });
      invalidateRoles();
      queryClient.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
      toast({ title: `"${role.name}" deleted` });
    } catch {
      toast({ title: "Error deleting role", variant: "destructive" });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Manage Employee Roles
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Define job roles for your business (e.g. Line Cook, Server, Cashier).
            </p>
            <Button
              size="sm"
              className="self-start"
              onClick={() => setRoleDialog({ open: true, name: "" })}
            >
              <Plus className="mr-1 h-4 w-4" /> New Role
            </Button>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !roles || roles.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No roles yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {roles.map((role) => (
                  <div key={role.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm font-medium">{role.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRoleDialog({ open: true, role, name: role.name })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(role)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={roleDialog.open} onOpenChange={(v) => setRoleDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{roleDialog.role ? "Edit Role" : "New Role"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Role Name *</Label>
              <Input
                value={roleDialog.name}
                onChange={(e) => setRoleDialog((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Line Cook, Server, Cashier"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog((d) => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createRole.isPending || updateRole.isPending}
            >
              {roleDialog.role ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const [employeeDialog, setEmployeeDialog] = useState<{
    open: boolean;
    employee?: Employee;
  }>({ open: false });
  const [detailSheet, setDetailSheet] = useState<{
    open: boolean;
    employee?: Employee;
  }>({ open: false });
  const [rolesSheet, setRolesSheet] = useState(false);

  const { data: locations } = useGetLocations();
  const { data: roles } = useGetEmployeeRoles();

  const queryParams = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(locationFilter !== "all" ? { locationId: parseInt(locationFilter) } : {}),
    ...(roleFilter !== "all" ? { roleId: parseInt(roleFilter) } : {}),
    ...(showInactive ? {} : { active: true }),
  };
  const { data: employees, isLoading } = useGetEmployees(queryParams, {
    query: { queryKey: getGetEmployeesQueryKey(queryParams) },
  });

  const deactivateEmployee = useDeactivateEmployee();
  const updateEmployee = useUpdateEmployee();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });

  const handleToggleActive = async (emp: Employee) => {
    try {
      if (emp.active) {
        await deactivateEmployee.mutateAsync({ id: emp.id });
        toast({ title: `${emp.name} deactivated` });
      } else {
        await updateEmployee.mutateAsync({ id: emp.id, data: { active: true } as UpdateEmployeeBody });
        toast({ title: `${emp.name} reactivated` });
      }
      invalidate();
    } catch {
      toast({ title: "Error updating employee", variant: "destructive" });
    }
  };

  const activeCount = employees?.filter((e) => e.active).length ?? 0;
  const totalCount = employees?.length ?? 0;

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">
            Manage your team members, roles, and assignments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setRolesSheet(true)}
          >
            <FolderOpen className="mr-2 h-4 w-4" /> Manage Roles
          </Button>
          <Button onClick={() => setEmployeeDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" /> Add Employee
          </Button>
        </div>
      </div>

      {!isLoading && employees && employees.length > 0 && (
        <div className="flex gap-4">
          <div className="rounded-lg border bg-card px-4 py-3 min-w-[120px]">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3 min-w-[120px]">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{totalCount}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations?.map((l) => (
                  <SelectItem key={l.id} value={l.id.toString()}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.id.toString()}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
                id="show-inactive-emp"
              />
              <Label htmlFor="show-inactive-emp" className="text-sm cursor-pointer">
                Show all
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !employees || employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No employees found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search || locationFilter !== "all" || roleFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Add your first employee to get started"}
              </p>
              {!search && locationFilter === "all" && roleFilter === "all" && (
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() => setEmployeeDialog({ open: true })}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Employee
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Hourly Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className={`cursor-pointer ${!emp.active ? "opacity-60" : ""}`}
                    onClick={() => setDetailSheet({ open: true, employee: emp })}
                  >
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {emp.roleName ?? <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {emp.locationName ?? <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {emp.email && (
                          <span className="text-xs text-muted-foreground">{emp.email}</span>
                        )}
                        {emp.phone && (
                          <span className="text-xs text-muted-foreground">{emp.phone}</span>
                        )}
                        {!emp.email && !emp.phone && (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {emp.hourlyRate
                        ? `$${parseFloat(emp.hourlyRate).toFixed(2)}`
                        : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.active ? "default" : "secondary"}>
                        {emp.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setDetailSheet({ open: false });
                              setEmployeeDialog({ open: true, employee: emp });
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(emp)}>
                            {emp.active ? "Deactivate" : "Reactivate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmployeeFormDialog
        open={employeeDialog.open}
        onOpenChange={(v) => setEmployeeDialog((d) => ({ ...d, open: v }))}
        employee={employeeDialog.employee}
        roles={roles ?? []}
        locations={locations ?? []}
        onSuccess={invalidate}
      />

      {detailSheet.employee && (
        <EmployeeDetailSheet
          open={detailSheet.open}
          onOpenChange={(v) => setDetailSheet((d) => ({ ...d, open: v }))}
          employee={detailSheet.employee}
          onEdit={() => {
            setDetailSheet((d) => ({ ...d, open: false }));
            setEmployeeDialog({ open: true, employee: detailSheet.employee });
          }}
        />
      )}

      <RolesManagerSheet open={rolesSheet} onOpenChange={setRolesSheet} />
    </div>
  );
}
