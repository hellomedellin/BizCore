import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Plus, Users, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Employee {
  id: string; name: string; email: string | null; phone: string | null;
  roleId: string | null; primaryLocationId: string | null; hourlyRate: string | null; active: boolean;
}
interface Role {
  id: string; name: string; color: string | null;
  permissionLevel: string | null; hourlyRateDefault: string | null;
}
interface Location { id: string; name: string; active?: boolean }
interface DefaultShift { dayOfWeek: number; startTime: string; endTime: string }

type EmpForm = { name: string; email: string; phone: string; roleId: string; hourlyRate: string; primaryLocationId: string };
const EMPTY_EMP_FORM: EmpForm = { name: "", email: "", phone: "", roleId: "", hourlyRate: "", primaryLocationId: "" };
type RoleForm = { name: string; color: string; permissionLevel: string; hourlyRateDefault: string };
const EMPTY_ROLE_FORM: RoleForm = { name: "", color: "#6366f1", permissionLevel: "staff", hourlyRateDefault: "" };

const COLOR_PALETTE = [
  "#f97316", "#ef4444", "#f59e0b", "#eab308",
  "#84cc16", "#10b981", "#06b6d4", "#3b82f6",
  "#6366f1", "#8b5cf6", "#ec4899", "#94a3b8",
];

const PERMISSION_OPTIONS = [
  { value: "staff",      label: "Staff",       desc: "Basic access — view schedule, clock in/out" },
  { value: "manager",    label: "Manager",     desc: "Manage orders, schedule, and team" },
  { value: "admin",      label: "Admin",       desc: "Full access to everything" },
  { value: "accountant", label: "Accountant",  desc: "Financial reports and invoices only" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function EmployeesPage() {
  const t = useT();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"team" | "roles">("team");

  // Employee dialog
  const [editing, setEditing] = useState<Employee | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDeleteEmp, setConfirmDeleteEmp] = useState(false);
  const [empForm, setEmpForm] = useState<EmpForm>(EMPTY_EMP_FORM);
  const [defaultShifts, setDefaultShifts] = useState<DefaultShift[]>([]);

  // Role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(EMPTY_ROLE_FORM);
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<Role | null>(null);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => api.get("/employees?active=true").then((r) => r.data as Employee[]),
  });
  const { data: roles } = useQuery({
    queryKey: ["employee-roles"],
    queryFn: () => api.get("/employee-roles").then((r) => r.data as Role[]),
  });
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data as Location[]),
  });

  const roleName = (id: string | null) => (id ? roles?.find((r) => r.id === id)?.name ?? "—" : "—");
  const roleColor = (id: string | null) => (id ? (roles?.find((r) => r.id === id)?.color ?? "#6366f1") : "#94a3b8");
  const errText = (e: any) => e?.response?.data?.error ?? t("common.error");
  const activeLocations = (locations ?? []).filter((l) => l.active !== false);

  useEffect(() => {
    if (editing) {
      api.get(`/employees/${editing.id}/default-shifts`)
        .then((r) => setDefaultShifts(r.data as DefaultShift[]))
        .catch(() => setDefaultShifts([]));
    }
  }, [editing?.id]);

  function openCreate() { setEmpForm(EMPTY_EMP_FORM); setDefaultShifts([]); setCreateOpen(true); }
  function openEdit(emp: Employee) {
    setEmpForm({
      name: emp.name, email: emp.email ?? "", phone: emp.phone ?? "",
      roleId: emp.roleId ?? "", hourlyRate: emp.hourlyRate ?? "",
      primaryLocationId: emp.primaryLocationId ?? "",
    });
    setDefaultShifts([]);
    setEditing(emp);
  }
  function openRoleCreate() { setEditingRole(null); setRoleForm(EMPTY_ROLE_FORM); setRoleDialogOpen(true); }
  function openRoleEdit(r: Role) {
    setEditingRole(r);
    setRoleForm({ name: r.name, color: r.color ?? "#6366f1", permissionLevel: r.permissionLevel ?? "staff", hourlyRateDefault: r.hourlyRateDefault ?? "" });
    setRoleDialogOpen(true);
  }

  // ── Employee mutations ──────────────────────────────────────────────────────
  async function saveDefaultShifts(empId: string) {
    await api.put(`/employees/${empId}/default-shifts`, { shifts: defaultShifts });
  }

  const createEmp = useMutation({
    mutationFn: async () => {
      const r = await api.post("/employees", {
        name: empForm.name.trim(), email: empForm.email || null, phone: empForm.phone || null,
        roleId: empForm.roleId || null, hourlyRate: empForm.hourlyRate || null,
        primaryLocationId: empForm.primaryLocationId || null,
      });
      await saveDefaultShifts(r.data.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setCreateOpen(false);
      setEmpForm(EMPTY_EMP_FORM);
      toast({ title: t("employees.toast.added"), variant: "success" });
    },
    onError: (e) => toast({ title: t("employees.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  const updateEmp = useMutation({
    mutationFn: async () => {
      await api.patch(`/employees/${editing!.id}`, {
        name: empForm.name.trim(), email: empForm.email || null, phone: empForm.phone || null,
        roleId: empForm.roleId || null, hourlyRate: empForm.hourlyRate || null,
        primaryLocationId: empForm.primaryLocationId || null,
      });
      await saveDefaultShifts(editing!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditing(null);
      toast({ title: t("employees.toast.saved"), variant: "success" });
    },
    onError: (e) => toast({ title: t("employees.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  const removeEmp = useMutation({
    mutationFn: () => api.patch(`/employees/${editing!.id}`, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setConfirmDeleteEmp(false);
      setEditing(null);
      toast({ title: t("employees.toast.removed"), variant: "success" });
    },
    onError: (e) => { setConfirmDeleteEmp(false); toast({ title: t("employees.toast.couldntRemove"), description: errText(e), variant: "destructive" }); },
  });

  // ── Role mutations ──────────────────────────────────────────────────────────
  const saveRole = useMutation({
    mutationFn: () => editingRole
      ? api.patch(`/employee-roles/${editingRole.id}`, roleForm)
      : api.post("/employee-roles", roleForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-roles"] });
      setRoleDialogOpen(false);
      setEditingRole(null);
      setRoleForm(EMPTY_ROLE_FORM);
      toast({ title: t("employees.roles.toast.saved"), variant: "success" });
    },
    onError: (e) => toast({ title: t("employees.roles.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => api.delete(`/employee-roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-roles"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      setConfirmDeleteRole(null);
      toast({ title: t("employees.roles.toast.deleted"), variant: "success" });
    },
    onError: (e) => { setConfirmDeleteRole(null); toast({ title: t("employees.roles.toast.couldntDelete"), description: errText(e), variant: "destructive" }); },
  });

  // ── Default shift helpers ───────────────────────────────────────────────────
  function toggleDay(dow: number) {
    if (defaultShifts.find((d) => d.dayOfWeek === dow)) {
      setDefaultShifts(defaultShifts.filter((d) => d.dayOfWeek !== dow));
    } else {
      setDefaultShifts([...defaultShifts, { dayOfWeek: dow, startTime: "08:00", endTime: "16:30" }]);
    }
  }
  function updateDayTime(dow: number, field: "startTime" | "endTime", val: string) {
    setDefaultShifts(defaultShifts.map((d) => d.dayOfWeek === dow ? { ...d, [field]: val } : d));
  }

  // ── Employee form ───────────────────────────────────────────────────────────
  function renderEmpFields() {
    return (
      <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-1.5">
          <Label>{t("employees.form.label.name")}</Label>
          <Input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} placeholder={t("employees.form.placeholder.name")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("employees.form.label.phone")}</Label>
            <Input value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("employees.form.label.email")}</Label>
            <Input type="email" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("employees.form.label.role")}</Label>
            <Select value={empForm.roleId || "none"} onValueChange={(v) => setEmpForm({ ...empForm, roleId: v === "none" ? "" : v })}>
              <SelectTrigger>
                <SelectValue placeholder={t("employees.form.role.noRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("employees.form.role.noRole")}</SelectItem>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color ?? "#6366f1" }} />
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("employees.form.label.hourlyRate")}</Label>
            <Input value={empForm.hourlyRate} onChange={(e) => setEmpForm({ ...empForm, hourlyRate: e.target.value })} placeholder={t("employees.form.placeholder.hourlyRate")} inputMode="decimal" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("employees.form.label.primaryLocation")}</Label>
          <Select value={empForm.primaryLocationId || "none"} onValueChange={(v) => setEmpForm({ ...empForm, primaryLocationId: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder={t("employees.form.location.noLocation")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("employees.form.location.noLocation")}</SelectItem>
              {activeLocations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Hint>{t("employees.form.hint.primaryLocation")}</Hint>
        </div>

        {/* Default schedule */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{t("employees.defaultSchedule.title")}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t("employees.defaultSchedule.hint")}</p>
          </div>
          <div className="space-y-2">
            {DAY_ORDER.map((dow) => {
              const ds = defaultShifts.find((d) => d.dayOfWeek === dow);
              return (
                <div key={dow} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!ds}
                    onChange={() => toggleDay(dow)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer flex-shrink-0"
                  />
                  <span className="w-8 text-sm font-medium text-slate-700 flex-shrink-0">{DAY_LABELS[dow]}</span>
                  {ds ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="time"
                        value={ds.startTime}
                        onChange={(e) => updateDayTime(dow, "startTime", e.target.value)}
                        className="h-8 rounded border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        style={{ minWidth: "7.5rem" }}
                      />
                      <span className="text-slate-400 text-sm flex-shrink-0">–</span>
                      <input
                        type="time"
                        value={ds.endTime}
                        onChange={(e) => updateDayTime(dow, "endTime", e.target.value)}
                        className="h-8 rounded border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        style={{ minWidth: "7.5rem" }}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">{t("employees.defaultSchedule.dayOff")}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const empPending = createEmp.isPending || updateEmp.isPending;

  // ── Roles tab ───────────────────────────────────────────────────────────────
  const empCountByRole = (roleId: string) => (employees ?? []).filter((e) => e.roleId === roleId).length;
  const permLabel = (level: string | null) => PERMISSION_OPTIONS.find((p) => p.value === level)?.label ?? "Staff";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("employees.title")}</h1>
          <p className="text-sm text-slate-500">{t("employees.subtitle")}</p>
        </div>
        {activeTab === "team" ? (
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> {t("employees.addLabel")}
          </Button>
        ) : (
          <Button onClick={openRoleCreate}>
            <Plus className="mr-1 h-4 w-4" /> {t("employees.roles.btn.add")}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {(["team", "roles"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {tab === "team" ? t("employees.tabs.team") : t("employees.tabs.roles")}
          </button>
        ))}
      </div>

      {/* ── Team tab ── */}
      {activeTab === "team" && (
        isLoading ? null : (employees ?? []).length === 0 ? (
          <GuidedEmptyState
            icon={Users}
            title={t("employees.emptyTitle")}
            description={t("employees.emptyDescription")}
            actionLabel={t("employees.addLabel")}
            onAction={openCreate}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">{t("employees.table.col.name")}</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">{t("employees.table.col.role")}</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">{t("employees.table.col.phone")}</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">{t("employees.table.col.pay")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(employees ?? []).map((emp) => (
                    <tr key={emp.id} onClick={() => openEdit(emp)} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{emp.name}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: roleColor(emp.roleId) }} />
                          <span className="text-slate-600">{roleName(emp.roleId)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{emp.phone ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{emp.hourlyRate ? `${formatCurrency(emp.hourlyRate)}/hr` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      )}

      {/* ── Roles tab ── */}
      {activeTab === "roles" && (
        (roles ?? []).length === 0 ? (
          <GuidedEmptyState
            icon={ShieldCheck}
            title={t("employees.roles.emptyTitle")}
            description={t("employees.roles.emptyDescription")}
            actionLabel={t("employees.roles.btn.add")}
            onAction={openRoleCreate}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">{t("employees.roles.table.col.name")}</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">{t("employees.roles.table.col.permission")}</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">{t("employees.roles.table.col.rate")}</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">{t("employees.roles.table.col.employees")}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {(roles ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color ?? "#6366f1" }} />
                          <span className="font-medium text-slate-900">{r.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          r.permissionLevel === "admin"       && "bg-red-50 text-red-700",
                          r.permissionLevel === "manager"     && "bg-amber-50 text-amber-700",
                          r.permissionLevel === "accountant"  && "bg-blue-50 text-blue-700",
                          (!r.permissionLevel || r.permissionLevel === "staff") && "bg-slate-100 text-slate-600",
                        )}>
                          {permLabel(r.permissionLevel)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {r.hourlyRateDefault ? `${formatCurrency(r.hourlyRateDefault)}/hr` : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {empCountByRole(r.id)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openRoleEdit(r)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmDeleteRole(r)} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      )}

      {/* ── Employee create dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("employees.addLabel")}</DialogTitle></DialogHeader>
          {renderEmpFields()}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={!empForm.name.trim() || empPending} onClick={() => createEmp.mutate()}>
              {empPending ? t("common.saving") : t("employees.addLabel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Employee edit dialog ── */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("employees.entitySingular")}</DialogTitle></DialogHeader>
          {renderEmpFields()}
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDeleteEmp(true)}>
              {t("employees.removeLabel")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              <Button disabled={!empForm.name.trim() || empPending} onClick={() => updateEmp.mutate()}>
                {empPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Role add/edit dialog ── */}
      <Dialog open={roleDialogOpen} onOpenChange={(o) => { if (!o) { setRoleDialogOpen(false); setEditingRole(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRole ? t("employees.roles.editRole") : t("employees.roles.newRole")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("employees.roles.label.name")}</Label>
              <Input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder={t("employees.roles.placeholder.name")} />
            </div>

            <div className="space-y-2">
              <Label>{t("employees.roles.label.color")}</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRoleForm({ ...roleForm, color: c })}
                    className="w-8 h-8 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                    style={{
                      backgroundColor: c,
                      boxShadow: roleForm.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("employees.roles.label.permission")}</Label>
              <Select value={roleForm.permissionLevel} onValueChange={(v) => setRoleForm({ ...roleForm, permissionLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERMISSION_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-xs text-slate-400">{p.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Hint>{t("employees.roles.hint.permission")}</Hint>
            </div>

            <div className="space-y-1.5">
              <Label>{t("employees.roles.label.defaultRate")}</Label>
              <Input value={roleForm.hourlyRateDefault} onChange={(e) => setRoleForm({ ...roleForm, hourlyRateDefault: e.target.value })} placeholder={t("employees.roles.placeholder.rate")} inputMode="decimal" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => { setRoleDialogOpen(false); setEditingRole(null); }}>{t("common.cancel")}</Button>
            <Button disabled={!roleForm.name.trim() || saveRole.isPending} onClick={() => saveRole.mutate()}>
              {saveRole.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirm remove employee ── */}
      <ConfirmDialog
        open={confirmDeleteEmp}
        onOpenChange={setConfirmDeleteEmp}
        title={t("employees.confirmRemove.title")}
        description={t("employees.removeDescription")}
        confirmLabel={t("employees.confirmRemove.confirmLabel")}
        destructive
        loading={removeEmp.isPending}
        onConfirm={() => removeEmp.mutate()}
      />

      {/* ── Confirm delete role ── */}
      <ConfirmDialog
        open={!!confirmDeleteRole}
        onOpenChange={(o) => { if (!o) setConfirmDeleteRole(null); }}
        title={t("employees.roles.confirmDelete.title")}
        description={t("employees.roles.confirmDelete.description")}
        confirmLabel={t("employees.roles.confirmDelete.confirmLabel")}
        destructive
        loading={deleteRole.isPending}
        onConfirm={() => confirmDeleteRole && deleteRole.mutate(confirmDeleteRole.id)}
      />
    </div>
  );
}
