import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/ui/hint";
import { DirectoryCatalog } from "@/components/DirectoryCatalog";
import { formatCurrency } from "@/lib/utils";
import { Users } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roleId: string | null;
  primaryLocationId: string | null;
  hourlyRate: string | null;
}
interface Role { id: string; name: string }
interface Location { id: string; name: string; active?: boolean }

type F = { name: string; email: string; phone: string; roleId: string; hourlyRate: string; primaryLocationId: string };
const EMPTY: F = { name: "", email: "", phone: "", roleId: "", hourlyRate: "", primaryLocationId: "" };

export function EmployeesPage() {
  const t = useT();

  const { data: roles } = useQuery({
    queryKey: ["employee-roles"],
    queryFn: () => api.get("/employee-roles").then((r) => r.data as Role[]),
  });
  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data as Location[]),
  });

  const roleName = (id: string | null) => (id ? roles?.find((r) => r.id === id)?.name ?? "—" : "—");

  return (
    <DirectoryCatalog<Employee, F>
      queryKey={["employees"]}
      endpoint="/employees"
      emptyForm={EMPTY}
      toFormValues={(e) => ({
        name: e.name,
        email: e.email ?? "",
        phone: e.phone ?? "",
        roleId: e.roleId ?? "",
        hourlyRate: e.hourlyRate ?? "",
        primaryLocationId: e.primaryLocationId ?? "",
      })}
      toPayload={(f) => ({
        name: f.name.trim(),
        email: f.email || null,
        phone: f.phone || null,
        roleId: f.roleId || null,
        hourlyRate: f.hourlyRate || null,
        primaryLocationId: f.primaryLocationId || null,
      })}
      title={t("employees.title")}
      subtitle={t("employees.subtitle")}
      icon={Users}
      emptyTitle={t("employees.emptyTitle")}
      emptyDescription={t("employees.emptyDescription")}
      addLabel={t("employees.addLabel")}
      entitySingular={t("employees.entitySingular")}
      removeDescription={t("employees.removeDescription")}
      toastAdded={t("employees.toast.added")}
      columns={[
        { header: t("employees.table.col.name"), render: (e) => e.name, className: "font-medium" },
        { header: t("employees.table.col.role"), render: (e) => roleName(e.roleId) },
        { header: t("employees.table.col.phone"), render: (e) => e.phone ?? "—" },
        { header: t("employees.table.col.pay"), render: (e) => (e.hourlyRate ? `${formatCurrency(e.hourlyRate)}/hr` : "—"), align: "right" },
      ]}
      renderFields={(form, setForm) => (
        <div className="space-y-4 pt-2">
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
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
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
            <Select
              value={form.primaryLocationId || "none"}
              onValueChange={(v) => setForm({ ...form, primaryLocationId: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("employees.form.location.noLocation")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("employees.form.location.noLocation")}</SelectItem>
                {(locations ?? []).filter((l) => l.active !== false).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Hint>{t("employees.form.hint.primaryLocation")}</Hint>
          </div>
        </div>
      )}
    />
  );
}
