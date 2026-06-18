import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DirectoryCatalog } from "@/components/DirectoryCatalog";
import { BookUser } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

type F = { name: string; phone: string; email: string; notes: string };
const EMPTY: F = { name: "", phone: "", email: "", notes: "" };

export function CustomersPage() {
  const t = useT();

  return (
    <DirectoryCatalog<Customer, F>
      queryKey={["customers"]}
      endpoint="/customers"
      emptyForm={EMPTY}
      toFormValues={(c) => ({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" })}
      toPayload={(f) => ({ name: f.name.trim(), phone: f.phone || null, email: f.email || null, notes: f.notes || null })}
      title={t("customers.title")}
      subtitle={t("customers.subtitle")}
      icon={BookUser}
      emptyTitle={t("customers.emptyTitle")}
      emptyDescription={t("customers.emptyDescription")}
      addLabel={t("customers.addLabel")}
      entitySingular={t("customers.entitySingular")}
      removeDescription={t("customers.removeDescription")}
      toastAdded={t("customers.toast.added")}
      columns={[
        { header: t("customers.table.col.name"), render: (c) => c.name, className: "font-medium" },
        { header: t("customers.table.col.phone"), render: (c) => c.phone ?? "—" },
        { header: t("customers.table.col.email"), render: (c) => c.email ?? "—" },
      ]}
      renderFields={(form, setForm) => (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t("customers.form.label.name")}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("customers.form.placeholder.name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("customers.form.label.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("customers.form.label.email")}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("customers.form.label.notes")}</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("customers.form.placeholder.notes")} />
          </div>
        </div>
      )}
    />
  );
}
