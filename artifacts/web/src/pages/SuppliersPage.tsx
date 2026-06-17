import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DirectoryCatalog } from "@/components/DirectoryCatalog";
import { Tag } from "lucide-react";

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
      title="Suppliers"
      subtitle="The businesses you buy ingredients and supplies from."
      icon={Tag}
      emptyTitle="No suppliers yet"
      emptyDescription="Add the vendors you buy from. You'll pick a supplier when you create a purchase (a delivery) to restock ingredients."
      addLabel="Add supplier"
      entitySingular="supplier"
      removeDescription="They'll be hidden from your list. Past purchases are kept."
      columns={[
        { header: "Name", render: (s) => s.name, className: "font-medium" },
        { header: "Contact", render: (s) => s.contactName ?? "—" },
        { header: "Phone", render: (s) => s.phone ?? "—" },
        { header: "Email", render: (s) => s.email ?? "—" },
      ]}
      renderFields={(form, setForm) => (
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Roast Republic" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional — payment terms, what they supply…" />
          </div>
        </div>
      )}
    />
  );
}
