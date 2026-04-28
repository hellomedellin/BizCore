import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getGetCustomersQueryKey,
} from "@workspace/api-client-react";
import type { Customer } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Users, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

const EMPTY_FORM: CustomerFormData = { name: "", phone: "", email: "", notes: "" };

function CustomerFormDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  title,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: CustomerFormData;
  onSave: (data: CustomerFormData) => void;
  title: string;
  saving: boolean;
}) {
  const [form, setForm] = useState<CustomerFormData>(initial);

  const set = (key: keyof CustomerFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={set("name")} placeholder="Full name" />
          </div>
          <div className="grid gap-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={set("phone")} placeholder="+1 555 000 0000" />
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} placeholder="customer@example.com" />
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={set("notes")} placeholder="Any additional notes" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name.trim() || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  name,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  name: string;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Customer</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);

  const queryParams = { search: search.trim() || undefined };
  const { data: customers, isLoading } = useGetCustomers(queryParams, {
    query: { queryKey: getGetCustomersQueryKey(queryParams) },
  });

  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomerMutation = useDeleteCustomer();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCustomersQueryKey({}) });
  };

  const handleCreate = async (form: CustomerFormData) => {
    try {
      await createCustomer.mutateAsync({
        data: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      toast({ title: `Customer "${form.name}" created` });
      setCreateOpen(false);
      invalidate();
    } catch {
      toast({ title: "Failed to create customer", variant: "destructive" });
    }
  };

  const handleUpdate = async (form: CustomerFormData) => {
    if (!editCustomer) return;
    try {
      await updateCustomer.mutateAsync({
        id: editCustomer.id,
        data: {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          notes: form.notes.trim() || null,
        },
      });
      toast({ title: `Customer "${form.name}" updated` });
      setEditCustomer(null);
      invalidate();
    } catch {
      toast({ title: "Failed to update customer", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteCustomer) return;
    try {
      await deleteCustomerMutation.mutateAsync({ id: deleteCustomer.id });
      toast({ title: `Customer "${deleteCustomer.name}" deleted` });
      setDeleteCustomer(null);
      invalidate();
    } catch {
      toast({ title: "Failed to delete customer", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage your customer records.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Customer
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b last:border-0">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-40" />
              </div>
            ))}
          </CardContent>
        ) : !customers?.length ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">
              {search ? "No customers match your search" : "No customers yet"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> New Customer
              </Button>
            )}
          </CardContent>
        ) : (
          <>
            <CardHeader className="py-3 px-6">
              <p className="text-sm text-muted-foreground">{customers.length} customer{customers.length !== 1 ? "s" : ""}</p>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{c.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditCustomer(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteCustomer(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Card>

      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={EMPTY_FORM}
        onSave={handleCreate}
        title="New Customer"
        saving={createCustomer.isPending}
      />

      {editCustomer && (
        <CustomerFormDialog
          open={!!editCustomer}
          onOpenChange={(v) => { if (!v) setEditCustomer(null); }}
          initial={{
            name: editCustomer.name,
            phone: editCustomer.phone ?? "",
            email: editCustomer.email ?? "",
            notes: editCustomer.notes ?? "",
          }}
          onSave={handleUpdate}
          title={`Edit ${editCustomer.name}`}
          saving={updateCustomer.isPending}
        />
      )}

      {deleteCustomer && (
        <DeleteConfirmDialog
          open={!!deleteCustomer}
          onOpenChange={(v) => { if (!v) setDeleteCustomer(null); }}
          name={deleteCustomer.name}
          onConfirm={handleDelete}
          deleting={deleteCustomerMutation.isPending}
        />
      )}
    </div>
  );
}
