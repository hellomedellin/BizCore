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
import { Plus, Users, Settings2 } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Employee {
  id: string; name: string; email: string | null; phone: string | null;
  roleId: string | null; primaryLocationId: string | null; hourlyRate: string | null; active: boolean;
}
interface Role { id: string; name: string; color: string | null; hourlyRateDefault: string | null }
interface Location { id: string; name: string; active?: boolean }
interface DefaultShift { dayOfWeek: number; startTime: string; endTime: string }

type EmpForm = { name: string; email: string; phone: string; roleId: string; hourlyRate: string; primaryLocationId: string };
const EMPTY_FORM: EmpForm = { name: "", email: "", phone: "", roleId: "", hourlyRate: "", primaryLocationId: "" };

const COLOR_PALETTE = [
  "#f97316", "#ef4444", "#f59e0b", "#84cc16",
  "#10b981", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#ec4899", "#14b8a6", "#94a3b8",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Display order: Mon(1) Tue(2) Wed(3) Thu(4) Fri(5) Sat(6) Sun(0)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function EmployeesPage() {
  const t = useT();
  const qc = useQueryClient();

  // ── Employee dialog state ───────────────────────────────────────────────────
  const [editing, setEditing] = useState<Employee | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<EmpForm>(EMPTY_FORM);
  const [defaultShifts, setDefaultShifts] = useState<DefaultShift[]>([]);

  // ── Roles dialog state ──────────────────────────────────────────────────────
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: "", color: "#6366f1", hourlyRateDefault: "" });
  const [editingRole, setEditingRole] = useState<Role | null>(null);

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

  // ── Load default shifts when opening edit ───────────────────────────────────
  useEffect(() => {
    if (editing) {
      api.get(`/employees/${editing.id}/default-shifts`)
        .then((r) => setDefaultShifts(r.data as DefaultShift[]))
        .catch(() => setDefaultShifts([]));
    }
  }, [editing?.id]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDefaultShifts([]);
    setCreateOpen(true);
  }
  function openEdit(emp: Employee) {
    setForm({
      name: emp.name, email: emp.email ?? "", phone: emp.phone ?? "",
      roleId: emp.roleId ?? "", hourlyRate: emp.hourlyRate ?? "",
      primaryLocationId: emp.primaryLocationId ?? "",
    });
    setDefaultShifts([]);
    setEditing(emp);
  }

  // ── Employee mutations ──────────────────────────────────────────────────────
  async function saveDefaultShifts(empId: string) {
    await api.put(`/employees/${empId}/default-shifts`, { shifts: defaultShifts });
  }

  const createEmp = useMutation({
    mutationFn: async () => {
      const r = await api.post("/employees", {
        name: form.name.trim(), email: form.email || null, phone: form.phone || null,
        roleId: form.roleId || null, hourlyRate: form.hourlyRate || null,
        primaryLocationId: form.primaryLocationId || null,
      });
      await saveDefaultShifts(r.data.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: t("employees.toast.added"), variant: "success" });
    },
    onError: (e) => toast({ title: t("employees.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  const updateEmp = useMutation({
    mutationFn: async () => {
      await api.patch(`/employees/${editing!.id}`, {
        name: form.name.trim(), email: form.email || null, phone: form.phone || null,
        roleId: form.roleId || null, hourlyRate: form.hourlyRate || null,
        primaryLocationId: form.primaryLocationId || null,
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
      setConfirmDelete(false);
      setEditing(null);
      toast({ title: t("employees.toast.removed"), variant: "success" });
    },
    onError: (e) => { setConfirmDelete(false); toast({ title: t("employees.toast.couldntRemove"), description: errText(e), variant: "destructive" }); },
  });

  // ── Role mutations ──────────────────────────────────────────────────────────
  const saveRole = useMutation({
    mutationFn: () => editingRole
      ? api.patch(`/employee-roles/${editingRole.id}`, roleForm)
      : api.post("/employee-roles", roleForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-roles"] });
      setEditingRole(null);
      setRoleForm({ name: "", color: "#6366f1", hourlyRateDefault: "" });
      toast({ title: t("employees.roles.toast.saved"), variant: "success" });
    },
    onError: (e) => toast({ title: t("employees.roles.toast.couldntSave"), description: errText(e), variant: "destructive" }),
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

  // ── Render employee form fields ─────────────────────────────────────────────
  function renderEmpFields() {
    return (
      <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-1.5">
          <Label>{t("employees.form.label.name")}</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("employees.form.placeholder.name")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("employees.form.label.phone")}</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("employees.form.label.email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("employees.form.label.role")}</Label>
            <Select value={form.roleId || "none"} onValueChange={(v) => setForm({ ...form, roleId: v === "none" ? "" : v })}>
              <SelectTrigger>
                <SelectValue placeholder={t("employees.form.role.noRole")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("employees.form.role.noRole")}</SelectItem>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color ?? "#6366f1" }} />
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("employees.form.label.hourlyRate")}</Label>
            <Input value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} placeholder={t("employees.form.placeholder.hourlyRate")} inputMode="decimal" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("employees.form.label.primaryLocation")}</Label>
          <Select value={form.primaryLocationId || "none"} onValueChange={(v) => setForm({ ...form, primaryLocationId: v === "none" ? "" : v })}>
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
                <div key={dow} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={!!ds}
                    onChange={() => toggleDay(dow)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer"
                  />
                  <span className="w-8 text-sm font-medium text-slate-700">{DAY_LABELS[dow]}</span>
                  {ds ? (
                    <>
                      <input
                        type="time"
                        value={ds.startTime}
                        onChange={(e) => updateDayTime(dow, "startTime", e.target.value)}
                        className="h-7 w-24 rounded border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-slate-400 text-sm">–</span>
                      <input
                        type="time"
                        value={ds.endTime}
                        onChange={(e) => updateDayTime(dow, "endTime", e.target.value)}
                        className="h-7 w-24 rounded border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </>
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

  const isPending = createEmp.isPending || updateEmp.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("employees.title")}</h1>
          <p className="text-sm text-slate-500">{t("employees.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setEditingRole(null); setRoleForm({ name: "", color: "#6366f1", hourlyRateDefault: "" }); setRolesOpen(true); }}>
            <Settings2 className="mr-1 h-3.5 w-3.5" /> {t("employees.roles.btn.manage")}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> {t("employees.addLabel")}
          </Button>
        </div>
      </div>

      {isLoading ? null : (employees ?? []).length === 0 ? (
        <GuidedEmptyState icon={Users} title={t("employees.emptyTitle")} description={t("employees.emptyDescription")} actionLabel={t("employees.addLabel")} onAction={openCreate} />
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
                  <tr key={emp.id} onClick={() => openEdit(emp)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
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
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("employees.addLabel")}</DialogTitle></DialogHeader>
          {renderEmpFields()}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={!form.name.trim() || isPending} onClick={() => createEmp.mutate()}>
              {isPending ? t("common.saving") : t("employees.addLabel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("employees.entitySingular")}</DialogTitle></DialogHeader>
          {renderEmpFields()}
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
              {t("employees.removeLabel")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
              <Button disabled={!form.name.trim() || isPending} onClick={() => updateEmp.mutate()}>
                {isPending ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Roles management dialog */}
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("employees.roles.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Existing roles */}
            {(roles ?? []).length > 0 && (
              <div className="space-y-1 rounded-lg border border-slate-100 overflow-hidden">
                {(roles ?? []).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer" onClick={() => { setEditingRole(r); setRoleForm({ name: r.name, color: r.color ?? "#6366f1", hourlyRateDefault: r.hourlyRateDefault ?? "" }); }}>
                    <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: r.color ?? "#6366f1" }} />
                    <span className="flex-1 text-sm font-medium text-slate-800">{r.name}</span>
                    {r.hourlyRateDefault && <span className="text-xs text-slate-400">{formatCurrency(r.hourlyRateDefault)}/hr</span>}
                    <span className="text-xs text-indigo-500">{t("common.edit")}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Add / edit role form */}
            <div className="rounded-lg border border-slate-200 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {editingRole ? t("employees.roles.editRole") : t("employees.roles.newRole")}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("employees.roles.label.name")}</Label>
                <Input value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder={t("employees.roles.placeholder.name")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("employees.roles.label.color")}</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRoleForm({ ...roleForm, color: c })}
                      className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        boxShadow: roleForm.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("employees.roles.label.defaultRate")}</Label>
                <Input value={roleForm.hourlyRateDefault} onChange={(e) => setRoleForm({ ...roleForm, hourlyRateDefault: e.target.value })} placeholder={t("employees.roles.placeholder.rate")} inputMode="decimal" />
              </div>
              <div className="flex gap-2 justify-end">
                {editingRole && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingRole(null); setRoleForm({ name: "", color: "#6366f1", hourlyRateDefault: "" }); }}>
                    {t("common.cancel")}
                  </Button>
                )}
                <Button size="sm" disabled={!roleForm.name.trim() || saveRole.isPending} onClick={() => saveRole.mutate()}>
                  {saveRole.isPending ? t("common.saving") : editingRole ? t("common.save") : t("employees.roles.btn.add")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("employees.confirmRemove.title", { name: editing?.name ?? "" })}
        description={t("employees.removeDescription")}
        confirmLabel={t("employees.confirmRemove.confirmLabel")}
        destructive
        loading={removeEmp.isPending}
        onConfirm={() => removeEmp.mutate()}
      />
    </div>
  );
}
