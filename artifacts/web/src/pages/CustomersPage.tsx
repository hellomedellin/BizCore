import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DirectoryCatalog } from "@/components/DirectoryCatalog";
import { StatusBadge, orderTone } from "@/components/ui/status-badge";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDate } from "@/lib/utils";
import { BookUser } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

interface CustomerDetail {
  stats: { visitCount: number; totalSpent: string; lastVisit: string | null };
  recentOrders: { id: string; total: string; status: string; createdAt: string }[];
}

type F = { name: string; phone: string; email: string; notes: string };
const EMPTY: F = { name: "", phone: "", email: "", notes: "" };

// Order history shown inside the customer edit dialog.
function CustomerHistory({ id }: { id: string }) {
  const t = useT();
  const { fmt } = useCurrency();
  const { data } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.get(`/customers/${id}`).then((r) => r.data as CustomerDetail),
  });
  if (!data) return null;
  const { stats, recentOrders } = data;

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-sm font-medium text-slate-800">{t("customers.history.title")}</p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold tabular-nums text-slate-900">{stats.visitCount}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{t("customers.history.visits")}</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums text-slate-900">{fmt(stats.totalSpent)}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{t("customers.history.spent")}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{stats.lastVisit ? formatDate(stats.lastVisit) : t("customers.history.never")}</p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{t("customers.history.lastVisit")}</p>
        </div>
      </div>
      {recentOrders.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-md border border-slate-100 bg-white">
          {recentOrders.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
              <span className="text-slate-500">{formatDate(o.createdAt)}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums text-slate-700">{fmt(o.total)}</span>
                <StatusBadge tone={orderTone(o.status)}>{o.status}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
      renderDetail={(id) => <CustomerHistory id={id} />}
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
