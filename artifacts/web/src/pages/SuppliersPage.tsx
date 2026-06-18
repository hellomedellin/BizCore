import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DirectoryCatalog } from "@/components/DirectoryCatalog";
import { Tag } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

type F = { name: string; contactName: string; phone: string; email: string; address: string; notes: string };
const EMPTY: F = { name: "", contactName: "", phone: "", email: "", address: "", notes: "" };

export function SuppliersPage() {
  const t = useT();

  return (
    <DirectoryCatalog<Supplier, F>
      queryKey={["suppliers"]}
      endpoint="/suppliers"
      emptyForm={EMPTY}
      toFormValues={(s) => ({
        name: s.name,
        contactName: s.contactName ?? "",
        phone: s.phone ?? "",
        email: s.email ?? "",
        address: s.address ?? "",
        notes: s.notes ?? "",
      })}
      toPayload={(f) => ({
        name: f.name.trim(),
        contactName: f.contactName || null,
        phone: f.phone || null,
        email: f.email || null,
        address: f.address || null,
        notes: f.notes || null,
      })}
      title={t("suppliers.title")}
      subtitle={t("suppliers.subtitle")}
      icon={Tag}
      emptyTitle={t("suppliers.emptyTitle")}
      emptyDescription={t("suppliers.emptyDescription")}
      addLabel={t("suppliers.addLabel")}
      entitySingular={t("suppliers.entitySingular")}
      removeDescription={t("suppliers.removeDescription")}
      toastAdded={t("suppliers.toast.added")}
      columns={[
        { header: t("suppliers.table.col.name"), render: (s) => s.name, className: "font-medium" },
        { header: t("suppliers.table.col.contact"), render: (s) => s.contactName ?? "—" },
        { header: t("suppliers.table.col.phone"), render: (s) => s.phone ?? "—" },
        { header: t("suppliers.table.col.email"), render: (s) => s.email ?? "—" },
      ]}
      renderFields={(form, setForm) => (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t("suppliers.form.label.name")}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("suppliers.form.placeholder.name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("suppliers.form.label.contactName")}</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("suppliers.form.label.phone")}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("suppliers.form.label.email")}</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("suppliers.form.label.address")}</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("suppliers.form.label.notes")}</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("suppliers.form.placeholder.notes")} />
          </div>
        </div>
      )}
    />
  );
}
