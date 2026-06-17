import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DirectoryCatalog } from "@/components/DirectoryCatalog";
import { BookUser } from "lucide-react";

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
  return (
    <DirectoryCatalog<Customer, F>
      queryKey={["customers"]}
      endpoint="/customers"
      emptyForm={EMPTY}
      toFormValues={(c) => ({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", notes: c.notes ?? "" })}
      toPayload={(f) => ({ name: f.name.trim(), phone: f.phone || null, email: f.email || null, notes: f.notes || null })}
      title="Customers"
      subtitle="Your regulars and their details."
      icon={BookUser}
      emptyTitle="No customers yet"
      emptyDescription="Add regulars to keep their contact info and order history. You can also add a customer while taking an order."
      addLabel="Add customer"
      entitySingular="customer"
      removeDescription="They'll be hidden from your list. Past orders are kept."
      columns={[
        { header: "Name", render: (c) => c.name, className: "font-medium" },
        { header: "Phone", render: (c) => c.phone ?? "—" },
        { header: "Email", render: (c) => c.email ?? "—" },
      ]}
      renderFields={(form, setForm) => (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sarah Mitchell" />
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
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional — preferences, allergies…" />
          </div>
        </div>
      )}
    />
  );
}
