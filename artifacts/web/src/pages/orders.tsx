import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOrders,
  useCreateOrder,
  useGetOrder,
  useUpdateOrder,
  useDeleteOrder,
  useAddOrderLine,
  useUpdateOrderLine,
  useDeleteOrderLine,
  useGetCustomers,
  useCreateCustomer,
  useGetLocations,
  useGetItems,
  useGetItemVariants,
  getGetOrdersQueryKey,
  getGetOrderQueryKey,
  getGetItemVariantsQueryKey,
} from "@workspace/api-client-react";
import type {
  Order,
  OrderDetail,
  OrderLine,
  OrderStatusHistory,
  Customer,
  GetOrdersParams,
  GetOrdersStatus,
  CreateOrderBodyOrderType,
  UpdateOrderBodyStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import {
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  ChevronRight,
  UserPlus,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useEntityCustomFields } from "@/components/use-entity-custom-fields";
import { CustomFieldsSection } from "@/components/custom-fields-section";

const STATUS_FLOW: Record<string, string | null> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: null,
  cancelled: null,
  refunded: null,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  preparing: "default",
  ready: "default",
  completed: "outline",
  cancelled: "destructive",
  refunded: "destructive",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: "Dine In",
  pickup: "Pickup",
  delivery: "Delivery",
};

function getUserRole(user: ReturnType<typeof useUser>["user"]): string {
  return (user?.publicMetadata as Record<string, string>)?.role ?? "cashier";
}

function formatMoney(val: string | number | undefined | null): string {
  const n = parseFloat(String(val ?? "0"));
  return isNaN(n) ? "$0.00" : `$${n.toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "outline"} className="capitalize">
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function CustomerPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (customerId: number | null, name?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [selectedName, setSelectedName] = useState<string>("");
  const { toast } = useToast();
  const createCustomer = useCreateCustomer();

  const { data: customers } = useGetCustomers(
    { search: search.trim() || undefined },
    { query: { queryKey: ["customers", search] } }
  );

  const handleSelect = (c: Customer) => {
    setSelectedName(c.name);
    setSearch("");
    onChange(c.id, c.name);
  };

  const handleClear = () => {
    setSelectedName("");
    setSearch("");
    onChange(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const c = await createCustomer.mutateAsync({
        data: { name: newName.trim(), phone: newPhone || null, email: newEmail || null },
      });
      handleSelect(c);
      setCreating(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      toast({ title: `Customer "${c.name}" created` });
    } catch {
      toast({ title: "Failed to create customer", variant: "destructive" });
    }
  };

  if (creating) {
    return (
      <div className="border rounded-md p-3 space-y-2 bg-muted/30">
        <p className="text-sm font-medium">New Customer</p>
        <Input placeholder="Name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <Input placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
        <Input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createCustomer.isPending}>
            Create
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (value && selectedName) {
    return (
      <div className="flex items-center justify-between border rounded-md px-3 py-2">
        <span className="text-sm font-medium">{selectedName}</span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleClear}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {search.trim() && (
        <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
          {customers?.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => handleSelect(c)}
            >
              <span className="font-medium">{c.name}</span>
              {c.phone && <span className="text-muted-foreground ml-2">{c.phone}</span>}
            </button>
          ))}
          <button
            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-primary flex items-center gap-1"
            onClick={() => { setCreating(true); setNewName(search.trim()); }}
          >
            <UserPlus className="h-3 w-3" />
            Create "{search.trim()}"
          </button>
        </div>
      )}
      {!search.trim() && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setCreating(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> New Customer
        </Button>
      )}
    </div>
  );
}

function AddLineDialog({
  open,
  onOpenChange,
  orderId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orderId: number;
  onSuccess: (detail: OrderDetail) => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState("none");
  const [form, setForm] = useState({ variantId: "none", quantity: "1", price: "", notes: "", modifiers: "" });
  const { toast } = useToast();
  const addLine = useAddOrderLine();

  useEffect(() => {
    if (!open) {
      setSelectedItemId("none");
      setForm({ variantId: "none", quantity: "1", price: "", notes: "", modifiers: "" });
    }
  }, [open]);

  const activeItemsParams = { active: true };
  const { data: items } = useGetItems(activeItemsParams, {
    query: { enabled: open, queryKey: ["items-for-order", activeItemsParams] },
  });

  const itemIdNum = selectedItemId !== "none" ? parseInt(selectedItemId) : 0;
  const { data: variants } = useGetItemVariants(itemIdNum, {
    query: { enabled: open && itemIdNum > 0, queryKey: getGetItemVariantsQueryKey(itemIdNum) },
  });

  const selectedVariant = variants?.find((v) => v.id.toString() === form.variantId);

  useEffect(() => {
    if (selectedVariant?.price) {
      setForm((f) => ({ ...f, price: selectedVariant.price! }));
    }
  }, [selectedVariant]);

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId);
    setForm((f) => ({ ...f, variantId: "none", price: "" }));
  };

  const handleSubmit = async () => {
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }
    if (!form.price) {
      toast({ title: "Enter a price", variant: "destructive" });
      return;
    }

    const selectedItem = items?.find((i) => i.id.toString() === selectedItemId);
    const name = selectedVariant
      ? `${selectedItem?.name ?? "Item"} — ${selectedVariant.name}`
      : selectedItem?.name ?? "Item";

    let parsedModifiers: Record<string, unknown> | null = null;
    if (form.modifiers.trim()) {
      try {
        parsedModifiers = JSON.parse(form.modifiers.trim());
      } catch {
        toast({ title: "Modifiers contain invalid JSON", variant: "destructive" });
        return;
      }
    }

    try {
      const result = await addLine.mutateAsync({
        orderId,
        data: {
          variantId: form.variantId !== "none" ? parseInt(form.variantId) : null,
          name,
          quantity: qty.toString(),
          price: parseFloat(form.price).toFixed(2),
          notes: form.notes || null,
          modifiers: parsedModifiers,
        },
      });
      toast({ title: "Line item added" });
      onSuccess(result);
      onOpenChange(false);
      setSelectedItemId("none");
      setForm({ variantId: "none", quantity: "1", price: "", notes: "", modifiers: "" });
    } catch {
      toast({ title: "Failed to add line item", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Item</Label>
            <Select value={selectedItemId} onValueChange={handleItemChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select an item...</SelectItem>
                {items?.map((item) => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    {item.name}
                    <span className="ml-1 text-xs text-muted-foreground capitalize">({item.type?.replace("_", " ")})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedItemId !== "none" && variants && variants.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Variant</Label>
              <Select value={form.variantId} onValueChange={(v) => setForm((f) => ({ ...f, variantId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select variant..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Default</SelectItem>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.name}{v.price ? ` — $${v.price}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Quantity *</Label>
              <Input
                type="number"
                step="0.001"
                min="0.001"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Price *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. no onions"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Modifiers (JSON)</Label>
            <Textarea
              value={form.modifiers}
              onChange={(e) => setForm((f) => ({ ...f, modifiers: e.target.value }))}
              placeholder={'{"add": ["extra cheese"], "remove": ["onions"]}'}
              rows={2}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Optional JSON for add-ons, removals, substitutions</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={addLine.isPending}>Add Item</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrderDetailSheet({
  orderId,
  open,
  onOpenChange,
  userRole,
  onOrderUpdated,
}: {
  orderId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userRole: string;
  onOrderUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [localOrder, setLocalOrder] = useState<OrderDetail | null>(null);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [editDiscount, setEditDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState("");

  const { data: fetchedOrder, isLoading } = useGetOrder(orderId ?? 0, {
    query: {
      enabled: open && !!orderId,
      queryKey: getGetOrderQueryKey(orderId ?? 0),
    },
  });

  useEffect(() => {
    if (fetchedOrder) setLocalOrder(fetchedOrder);
  }, [fetchedOrder]);

  useEffect(() => {
    if (localOrder) setDiscountValue(localOrder.discount ?? "0");
  }, [localOrder?.id]);

  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const deleteOrderLine = useDeleteOrderLine();

  const { fields: cfFields, values: cfValues, setFieldValue: cfSet, save: cfSave, isSaving: cfSaving } =
    useEntityCustomFields("order", open && orderId ? orderId : undefined);

  const handleSaveCustomFields = async () => {
    if (!orderId) return;
    try {
      await cfSave(orderId);
      toast({ title: "Custom fields saved" });
    } catch {
      toast({ title: "Error saving custom fields", variant: "destructive" });
    }
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId ?? 0) });
    onOrderUpdated();
  };

  const handleAdvanceStatus = async () => {
    if (!localOrder) return;
    const next = STATUS_FLOW[localOrder.status];
    if (!next) return;
    try {
      const result = await updateOrder.mutateAsync({
        id: localOrder.id,
        data: { status: next as UpdateOrderBodyStatus },
      });
      setLocalOrder(result);
      invalidate();
      toast({ title: `Status → ${STATUS_LABELS[next]}` });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    if (!localOrder) return;
    try {
      const result = await updateOrder.mutateAsync({
        id: localOrder.id,
        data: { status: "cancelled" as UpdateOrderBodyStatus },
      });
      setLocalOrder(result);
      invalidate();
      toast({ title: "Order cancelled" });
    } catch {
      toast({ title: "Failed to cancel order", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!localOrder) return;
    try {
      await deleteOrder.mutateAsync({ id: localOrder.id });
      onOpenChange(false);
      invalidate();
      toast({ title: "Order deleted" });
    } catch {
      toast({ title: "Failed to delete order", variant: "destructive" });
    }
  };

  const handleSaveDiscount = async () => {
    if (!localOrder) return;
    try {
      const result = await updateOrder.mutateAsync({
        id: localOrder.id,
        data: { discount: parseFloat(discountValue || "0").toFixed(2) },
      });
      setLocalOrder(result);
      setEditDiscount(false);
      invalidate();
      toast({ title: "Discount updated" });
    } catch {
      toast({ title: "Failed to update discount", variant: "destructive" });
    }
  };

  const handleRemoveLine = async (lineId: number) => {
    if (!localOrder) return;
    try {
      const result = await deleteOrderLine.mutateAsync({ orderId: localOrder.id, lineId });
      setLocalOrder(result);
      invalidate();
    } catch {
      toast({ title: "Failed to remove line", variant: "destructive" });
    }
  };

  const order = localOrder;
  const isEditable = order && !["completed", "cancelled", "refunded"].includes(order.status);
  const canCancel = userRole !== "cashier";
  const canDelete = userRole === "admin" || userRole === "manager";
  const nextStatus = order ? STATUS_FLOW[order.status] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading || !order ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Order #{order.id}
                <StatusBadge status={order.status} />
              </SheetTitle>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Type</p>
                <p className="font-medium">{ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}</p>
              </div>
              {order.tableNumber && (
                <div>
                  <p className="text-muted-foreground text-xs">Table</p>
                  <p className="font-medium">{order.tableNumber}</p>
                </div>
              )}
              {order.customerName && (
                <div>
                  <p className="text-muted-foreground text-xs">Customer</p>
                  <p className="font-medium">{order.customerName}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs">Created</p>
                <p className="font-medium">{format(new Date(order.createdAt), "MMM d, h:mm a")}</p>
              </div>
            </div>

            {order.notes && (
              <p className="text-sm text-muted-foreground italic border-l-2 pl-3">{order.notes}</p>
            )}

            <Separator />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Line Items</h3>
                {isEditable && (
                  <Button size="sm" variant="outline" onClick={() => setAddLineOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add Item
                  </Button>
                )}
              </div>

              {order.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No items yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {isEditable && <TableHead className="w-8" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.lines.map((line) => {
                      const lineTotal = parseFloat(line.quantity) * parseFloat(line.price);
                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{line.name}</p>
                              {line.notes && <p className="text-xs text-muted-foreground">{line.notes}</p>}
                              {line.modifiers && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {JSON.stringify(line.modifiers)}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm">{parseFloat(line.quantity)}</TableCell>
                          <TableCell className="text-right text-sm">{formatMoney(line.price)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatMoney(lineTotal)}</TableCell>
                          {isEditable && (
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveLine(line.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Discount</span>
                {editDiscount && (canCancel) ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-7 w-24 text-right"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                    />
                    <Button size="sm" onClick={handleSaveDiscount} disabled={updateOrder.isPending}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditDiscount(false)}>×</Button>
                  </div>
                ) : (
                  <button
                    className={`hover:underline ${canCancel ? "cursor-pointer" : ""}`}
                    onClick={() => canCancel && setEditDiscount(true)}
                  >
                    -{formatMoney(order.discount)}
                  </button>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatMoney(order.tax)}</span>
              </div>
              <div className="flex justify-between font-semibold text-base pt-1 border-t">
                <span>Total</span>
                <span>{formatMoney(order.total)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {nextStatus && (
                <Button onClick={handleAdvanceStatus} disabled={updateOrder.isPending} className="flex-1">
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Mark as {STATUS_LABELS[nextStatus]}
                </Button>
              )}
              {canCancel && order.status === "completed" && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const result = await updateOrder.mutateAsync({
                        id: order.id,
                        data: { status: "refunded" as UpdateOrderBodyStatus },
                      });
                      setLocalOrder(result);
                      invalidate();
                      toast({ title: "Order refunded" });
                    } catch {
                      toast({ title: "Failed to refund order", variant: "destructive" });
                    }
                  }}
                  disabled={updateOrder.isPending}
                  className="border-amber-500 text-amber-600 hover:bg-amber-50"
                >
                  Refund Order
                </Button>
              )}
              {isEditable && canCancel && (
                <Button variant="outline" onClick={handleCancel} disabled={updateOrder.isPending} className="border-destructive text-destructive hover:bg-destructive/10">
                  Cancel Order
                </Button>
              )}
              {canDelete && (order.status === "cancelled" || order.status === "refunded") && (
                <Button variant="destructive" onClick={handleDelete} disabled={deleteOrder.isPending}>
                  Delete
                </Button>
              )}
            </div>

            {order.statusHistory && order.statusHistory.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Status History</h3>
                  <div className="space-y-1.5">
                    {order.statusHistory.map((h: OrderStatusHistory) => (
                      <div key={h.id} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
                        <span className="text-muted-foreground text-xs shrink-0">
                          {format(new Date(h.changedAt), "MMM d, h:mm a")}
                        </span>
                        <span>
                          {h.fromStatus
                            ? <>{STATUS_LABELS[h.fromStatus] ?? h.fromStatus} → </>
                            : null}
                          <span className="font-medium">{STATUS_LABELS[h.toStatus] ?? h.toStatus}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {cfFields.length > 0 && (
              <>
                <CustomFieldsSection
                  fields={cfFields}
                  values={cfValues}
                  onChange={cfSet}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveCustomFields}
                  disabled={cfSaving}
                  className="w-full"
                >
                  Save Custom Fields
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>

      {order && (
        <AddLineDialog
          open={addLineOpen}
          onOpenChange={setAddLineOpen}
          orderId={order.id}
          onSuccess={(detail) => setLocalOrder(detail)}
        />
      )}
    </Sheet>
  );
}

function CreateOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (orderId: number) => void;
}) {
  const { toast } = useToast();
  const createOrder = useCreateOrder();
  const { data: locations } = useGetLocations();

  const [form, setForm] = useState({
    locationId: "none",
    orderType: "dine_in" as CreateOrderBodyOrderType,
    tableNumber: "",
    notes: "",
  });
  const [customerId, setCustomerId] = useState<number | null>(null);

  const { fields: cfFields, values: cfValues, setFieldValue: cfSet, save: cfSave, reset: cfReset } =
    useEntityCustomFields("order");

  const handleSubmit = async () => {
    if (form.locationId === "none") {
      toast({ title: "Select a location", variant: "destructive" });
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        data: {
          locationId: parseInt(form.locationId),
          orderType: form.orderType,
          customerId: customerId ?? null,
          tableNumber: form.tableNumber || null,
          notes: form.notes || null,
        },
      });
      if (cfFields.length > 0) {
        await cfSave(result.id);
      }
      toast({ title: `Order #${result.id} created` });
      onCreated(result.id);
      onOpenChange(false);
      setForm({ locationId: "none", orderType: "dine_in", tableNumber: "", notes: "" });
      setCustomerId(null);
      cfReset();
    } catch {
      toast({ title: "Failed to create order", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Location *</Label>
            <Select value={form.locationId} onValueChange={(v) => setForm((f) => ({ ...f, locationId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select location...</SelectItem>
                {locations?.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Order Type</Label>
            <Select value={form.orderType} onValueChange={(v) => setForm((f) => ({ ...f, orderType: v as CreateOrderBodyOrderType }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dine_in">Dine In</SelectItem>
                <SelectItem value="pickup">Pickup</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.orderType === "dine_in" && (
            <div className="grid gap-1.5">
              <Label>Table Number</Label>
              <Input
                value={form.tableNumber}
                onChange={(e) => setForm((f) => ({ ...f, tableNumber: e.target.value }))}
                placeholder="e.g. 12"
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Customer (Optional)</Label>
            <CustomerPicker value={customerId} onChange={(id) => setCustomerId(id)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any special notes for this order"
              rows={2}
            />
          </div>
          <CustomFieldsSection fields={cfFields} values={cfValues} onChange={cfSet} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createOrder.isPending}>Create Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const userRole = getUserRole(user);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOrderId, setDetailOrderId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [filters, setFilters] = useState<GetOrdersParams>({
    status: undefined,
    orderType: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    limit: 50,
    offset: 0,
  });
  const [locationFilter, setLocationFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: locations } = useGetLocations();

  const queryParams: GetOrdersParams = {
    ...filters,
    locationId: locationFilter !== "all" ? parseInt(locationFilter) : undefined,
    search: search.trim() || undefined,
  };

  const { data: ordersPage, isLoading } = useGetOrders(queryParams, {
    query: { queryKey: getGetOrdersQueryKey(queryParams) },
  });

  const handleCreated = (orderId: number) => {
    queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey({}) });
    setDetailOrderId(orderId);
    setDetailOpen(true);
  };

  const handleRowClick = (order: Order) => {
    setDetailOrderId(order.id);
    setDetailOpen(true);
  };

  const handleOrderUpdated = () => {
    queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey({}) });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">Record and track customer orders.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Order
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilters((f) => ({ ...f, offset: 0 })); }}
          />
        </div>
        <Select value={locationFilter} onValueChange={(v) => { setLocationFilter(v); setFilters((f) => ({ ...f, offset: 0 })); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations?.map((loc) => (
              <SelectItem key={loc.id} value={loc.id.toString()}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status ?? "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, offset: 0, status: v === "all" ? undefined : (v as GetOrdersStatus) }))}
        >
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.orderType ?? "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, offset: 0, orderType: v === "all" ? undefined : (v as GetOrdersParams["orderType"]) }))}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="dine_in">Dine In</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
            <SelectItem value="delivery">Delivery</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="shrink-0">Date range:</span>
          <Input
            type="date"
            className="w-[150px]"
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, offset: 0, dateFrom: e.target.value || undefined }))}
          />
          <span className="shrink-0">to</span>
          <Input
            type="date"
            className="w-[150px]"
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, offset: 0, dateTo: e.target.value || undefined }))}
          />
        </div>
        {(filters.dateFrom || filters.dateTo || filters.status || filters.orderType || locationFilter !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({ status: undefined, orderType: undefined, dateFrom: undefined, dateTo: undefined, limit: 50, offset: 0 });
              setLocationFilter("all");
              setSearch("");
            }}
          >
            <X className="h-4 w-4 mr-1" /> Clear filters
          </Button>
        )}
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b last:border-0">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20 ml-auto" />
              </div>
            ))}
          </CardContent>
        ) : !ordersPage?.orders.length ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">No orders found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || filters.status || filters.orderType || locationFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first order to get started"}
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader className="py-3 px-6">
              <p className="text-sm text-muted-foreground">
                Showing {ordersPage.orders.length} of {ordersPage.total} orders
              </p>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersPage.orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(order)}
                  >
                    <TableCell className="font-medium">#{order.id}</TableCell>
                    <TableCell>{order.customerName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{ORDER_TYPE_LABELS[order.orderType] ?? order.orderType}</TableCell>
                    <TableCell><StatusBadge status={order.status} /></TableCell>
                    <TableCell className="text-right font-medium">{formatMoney(order.total)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {format(new Date(order.createdAt), "MMM d, h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {ordersPage.total > 50 && (
              <div className="flex justify-center gap-2 py-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filters.offset ?? 0) === 0}
                  onClick={() => setFilters((f) => ({ ...f, offset: Math.max(0, (f.offset ?? 0) - 50) }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(filters.offset ?? 0) + 50 >= ordersPage.total}
                  onClick={() => setFilters((f) => ({ ...f, offset: (f.offset ?? 0) + 50 }))}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <CreateOrderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <OrderDetailSheet
        orderId={detailOrderId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        userRole={userRole}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
}
