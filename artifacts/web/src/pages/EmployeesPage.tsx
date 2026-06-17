import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/ui/hint";
import { DirectoryCatalog } from "@/components/DirectoryCatalog";
import { formatCurrency } from "@/lib/utils";
import { Users } from "lucide-react";

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
      title="Employees"
      subtitle="Your team and their roles."
      icon={Users}
      emptyTitle="No employees yet"
      emptyDescription="Add your team so you can schedule shifts and track hours. Give each person a role and pay rate."
      addLabel="Add employee"
      entitySingular="employee"
      removeDescription="They'll be hidden from your team list. Past shifts and hours are kept."
      columns={[
        { header: "Name", render: (e) => e.name, className: "font-medium" },
        { header: "Role", render: (e) => roleName(e.roleId) },
        { header: "Phone", render: (e) => e.phone ?? "—" },
        { header: "Pay", render: (e) => (e.hourlyRate ? `${formatCurrency(e.hourlyRate)}/hr` : "—"), align: "right" },
      ]}
      renderFields={(form, setForm) => (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sofia Garcia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.roleId || "none"} onValueChange={(v) => setForm({ ...form, roleId: v === "none" ? "" : v })}>
                <SelectTrigger>
                  <SelectValue placeholder="No role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No role</SelectItem>
                  {(roles ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hourly rate</Label>
              <Input value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} placeholder="0.00" inputMode="decimal" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Primary location</Label>
            <Select
              value={form.primaryLocationId || "none"}
              onValueChange={(v) => setForm({ ...form, primaryLocationId: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No location</SelectItem>
                {(locations ?? []).filter((l) => l.active !== false).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Hint>Where this person usually works. You can change it anytime.</Hint>
          </div>
        </div>
      )}
    />
  );
}
