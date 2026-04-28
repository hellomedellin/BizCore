import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetLocations,
  useGetInventory,
  useGetInventoryTransactions,
  useCreateInventoryTransaction,
  useUpdateInventoryEntry,
  useGetCategories,
  useGetItems,
  useGetItemVariants,
  getGetInventoryQueryKey,
  getGetInventoryTransactionsQueryKey,
  getGetItemVariantsQueryKey,
  getGetItemsQueryKey,
} from "@workspace/api-client-react";
import type { InventoryEntry, GetInventoryType } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Search, Package, Plus, ArrowDownToLine, ArrowUpFromLine, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";

const TRANSACTION_TYPES = [
  { value: "purchase", label: "Purchase (Add Stock)", icon: "+" },
  { value: "adjustment", label: "Adjustment", icon: "±" },
  { value: "waste", label: "Waste", icon: "-" },
  { value: "return", label: "Return", icon: "+" },
  { value: "transfer", label: "Transfer", icon: "→" },
];

const TXN_COLORS: Record<string, string> = {
  purchase: "text-green-600",
  return: "text-green-600",
  adjustment: "text-blue-600",
  waste: "text-red-600",
  transfer: "text-orange-600",
  sale: "text-red-600",
};

function RecordTransactionDialog({
  open,
  onOpenChange,
  locationId,
  preselectedEntry,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  locationId: number;
  preselectedEntry?: InventoryEntry;
  onSuccess: () => void;
}) {
  const [selectedItemId, setSelectedItemId] = useState<string>(
    preselectedEntry?.itemId?.toString() ?? "none"
  );
  const [form, setForm] = useState({
    variantId: preselectedEntry?.variantId?.toString() ?? "none",
    type: "purchase",
    quantity: "",
    notes: "",
    batchId: "",
    expiresAt: "",
  });

  const { toast } = useToast();
  const createTxn = useCreateInventoryTransaction();

  const activeItemsParams = { active: true };
  const { data: allItems } = useGetItems(activeItemsParams, {
    query: { enabled: open, queryKey: getGetItemsQueryKey(activeItemsParams) },
  });

  const itemIdNum = selectedItemId !== "none" ? parseInt(selectedItemId) : 0;
  const { data: itemVariants } = useGetItemVariants(itemIdNum, {
    query: {
      enabled: open && itemIdNum > 0,
      queryKey: getGetItemVariantsQueryKey(itemIdNum),
    },
  });

  const handleItemChange = (itemId: string) => {
    setSelectedItemId(itemId);
    setForm((f) => ({ ...f, variantId: "none" }));
  };

  const handleSubmit = async () => {
    if (form.variantId === "none") {
      toast({ title: "Select an item and variant", variant: "destructive" });
      return;
    }
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty === 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }

    const isDeduction = ["waste", "sale"].includes(form.type);
    const quantityChange = isDeduction ? (-Math.abs(qty)).toString() : Math.abs(qty).toString();

    try {
      await createTxn.mutateAsync({
        data: {
          variantId: parseInt(form.variantId),
          locationId,
          type: form.type as "purchase" | "adjustment" | "waste" | "return" | "transfer" | "sale",
          quantityChange,
          notes: form.notes || null,
          batchId: form.batchId.trim() || null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        },
      });
      toast({ title: "Transaction recorded" });
      onSuccess();
      onOpenChange(false);
      setSelectedItemId("none");
      setForm({ variantId: "none", type: "purchase", quantity: "", notes: "", batchId: "", expiresAt: "" });
    } catch {
      toast({ title: "Error recording transaction", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Inventory Transaction</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Item *</Label>
            <Select value={selectedItemId} onValueChange={handleItemChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select an item...</SelectItem>
                {allItems?.map((item) => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    {item.name}
                    <span className="ml-1 text-xs text-muted-foreground capitalize">
                      ({item.type?.replace("_", " ")})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Variant *</Label>
            <Select
              value={form.variantId}
              onValueChange={(v) => setForm((f) => ({ ...f, variantId: v }))}
              disabled={selectedItemId === "none"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a variant..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select a variant...</SelectItem>
                {itemVariants?.map((v) => (
                  <SelectItem key={v.id} value={v.id.toString()}>
                    {v.name}
                    {v.sku ? ` — ${v.sku}` : ""}
                    {v.attributes
                      ? ` (${Object.entries(v.attributes as Record<string, unknown>)
                          .map(([k, val]) => `${k}: ${val}`)
                          .join(", ")})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Transaction Type *</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Quantity *</Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="e.g. 10"
            />
            <p className="text-xs text-muted-foreground">
              Enter the amount to add or remove. Waste and sales will automatically be deducted.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Batch / Lot ID</Label>
              <Input
                value={form.batchId}
                onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
                placeholder="e.g. LOT-2024-001"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Expiry Date</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional note about this transaction"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createTxn.isPending}>
            Record Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetThresholdDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: InventoryEntry;
  onSuccess: () => void;
}) {
  const [threshold, setThreshold] = useState(
    entry.lowStockThreshold ? parseFloat(entry.lowStockThreshold).toString() : ""
  );
  const { toast } = useToast();
  const updateInventory = useUpdateInventoryEntry();

  const handleSave = async () => {
    const parsed = threshold === "" ? null : parseFloat(threshold);
    if (parsed !== null && isNaN(parsed)) {
      toast({ title: "Enter a valid number", variant: "destructive" });
      return;
    }
    try {
      await updateInventory.mutateAsync({
        id: entry.id,
        data: { lowStockThreshold: parsed !== null ? parsed.toString() : null },
      });
      toast({ title: "Threshold updated" });
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Error updating threshold", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Low Stock Threshold</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{entry.itemName}</span> — {entry.variantName}
          </p>
          <div className="grid gap-1.5">
            <Label>Alert when quantity falls below</Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 5 (leave blank to disable)"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Leave blank to disable low stock alerts for this item.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateInventory.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InventoryTable({
  locationId,
  search,
  categoryFilter,
  typeFilter,
  lowStockOnly,
  onRecordTransaction,
}: {
  locationId: number;
  search: string;
  categoryFilter: string;
  typeFilter: string;
  lowStockOnly: boolean;
  onRecordTransaction: (entry: InventoryEntry) => void;
}) {
  const queryClient = useQueryClient();
  const [thresholdDialog, setThresholdDialog] = useState<{ open: boolean; entry?: InventoryEntry }>({ open: false });
  const { data: inventory, isLoading } = useGetInventory({
    locationId,
    ...(search ? { search } : {}),
    ...(categoryFilter !== "all" ? { categoryId: parseInt(categoryFilter) } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter as GetInventoryType } : {}),
    ...(lowStockOnly ? { lowStock: true } : {}),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!inventory || inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground font-medium">No inventory found</p>
        <p className="text-sm text-muted-foreground mt-1">
          {lowStockOnly
            ? "No items are below their low stock threshold"
            : search || categoryFilter !== "all"
            ? "Try adjusting your filters"
            : "Record a purchase transaction to add stock to this location"}
        </p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Alert Below</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventory.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.itemName}</TableCell>
              <TableCell className="text-muted-foreground">{entry.variantName}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{entry.sku || "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {entry.categoryName || "—"}
              </TableCell>
              <TableCell className="text-right font-mono">
                {parseFloat(entry.quantity).toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                <button
                  className="hover:text-foreground transition-colors cursor-pointer"
                  onClick={() => setThresholdDialog({ open: true, entry })}
                  title="Set low stock threshold"
                >
                  {entry.lowStockThreshold
                    ? parseFloat(entry.lowStockThreshold).toFixed(2)
                    : <span className="text-xs text-muted-foreground/50">Set</span>}
                </button>
              </TableCell>
              <TableCell>
                {entry.isLowStock ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Low Stock
                  </Badge>
                ) : (
                  <Badge variant="secondary">OK</Badge>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRecordTransaction(entry)}
                  className="h-8 text-xs"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Adjust
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {thresholdDialog.entry && (
        <SetThresholdDialog
          open={thresholdDialog.open}
          onOpenChange={(v) => setThresholdDialog((d) => ({ ...d, open: v }))}
          entry={thresholdDialog.entry}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey({ locationId }) });
          }}
        />
      )}
    </>
  );
}

function TransactionLog({ locationId }: { locationId: number }) {
  const { data: txns, isLoading } = useGetInventoryTransactions({
    locationId,
    limit: 100,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!txns || txns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RefreshCw className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No transactions yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Record a purchase or adjustment to see transactions here
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Item</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Change</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {txns.map((txn) => {
          const change = parseFloat(txn.quantityChange);
          const expiresAt = txn.expiresAt ? new Date(txn.expiresAt) : null;
          const now = new Date();
          const daysUntilExpiry = expiresAt
            ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;
          return (
            <TableRow key={txn.id}>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {format(new Date(txn.createdAt), "MMM d, h:mm a")}
              </TableCell>
              <TableCell>
                <div className="font-medium text-sm">{txn.itemName}</div>
                <div className="text-xs text-muted-foreground">{txn.variantName}</div>
              </TableCell>
              <TableCell>
                <span className={`capitalize text-sm font-medium ${TXN_COLORS[txn.type] ?? ""}`}>
                  {txn.type}
                </span>
              </TableCell>
              <TableCell
                className={`text-right font-mono font-medium ${
                  change >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {change >= 0 ? "+" : ""}
                {change.toFixed(3)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {txn.batchId || "—"}
              </TableCell>
              <TableCell>
                {expiresAt ? (
                  <Badge
                    variant={
                      daysUntilExpiry !== null && daysUntilExpiry < 0
                        ? "destructive"
                        : daysUntilExpiry !== null && daysUntilExpiry <= 30
                        ? "secondary"
                        : "outline"
                    }
                    className={
                      daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : ""
                    }
                  >
                    {daysUntilExpiry !== null && daysUntilExpiry < 0
                      ? "Expired"
                      : format(expiresAt, "MMM d, yyyy")}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                {txn.notes || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [selectedLocationId, setSelectedLocationId] = useState<string>("none");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [txnDialog, setTxnDialog] = useState<{
    open: boolean;
    entry?: InventoryEntry;
  }>({ open: false });

  const { data: locations, isLoading: locationsLoading } = useGetLocations();
  const { data: categories } = useGetCategories();
  const inventoryLocationId = selectedLocationId !== "none" ? parseInt(selectedLocationId) : 0;
  const { data: inventoryEntries } = useGetInventory(
    { locationId: inventoryLocationId },
    {
      query: {
        enabled: selectedLocationId !== "none",
        queryKey: getGetInventoryQueryKey({ locationId: inventoryLocationId }),
      },
    },
  );

  const locationId = selectedLocationId !== "none" ? parseInt(selectedLocationId) : null;
  const lowStockCount = inventoryEntries?.filter((e) => e.isLowStock).length ?? 0;

  const handleRefresh = () => {
    if (!locationId) return;
    queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey({ locationId }) });
    queryClient.invalidateQueries({
      queryKey: getGetInventoryTransactionsQueryKey({ locationId }),
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground">
            Track stock levels and record transactions by location.
          </p>
        </div>
        {locationId && (
          <Button onClick={() => setTxnDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" /> Record Transaction
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="w-full sm:w-[240px]">
          {locationsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a location..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select a location...</SelectItem>
                {locations?.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {locationId && lowStockCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {lowStockCount} low stock item{lowStockCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {!locationId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">Select a location</p>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a location above to view inventory levels
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="stock">
          <TabsList>
            <TabsTrigger value="stock">Current Stock</TabsTrigger>
            <TabsTrigger value="transactions">Transaction Log</TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="ingredient">Ingredient</SelectItem>
                      <SelectItem value="menu_item">Menu Item</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories?.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Switch
                      checked={lowStockOnly}
                      onCheckedChange={setLowStockOnly}
                      id="low-stock-only"
                    />
                    <Label htmlFor="low-stock-only" className="text-sm cursor-pointer text-red-600 font-medium">
                      Low stock only
                    </Label>
                  </div>
                  <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <InventoryTable
                  locationId={locationId}
                  search={search}
                  categoryFilter={categoryFilter}
                  typeFilter={typeFilter}
                  lowStockOnly={lowStockOnly}
                  onRecordTransaction={(entry) => setTxnDialog({ open: true, entry })}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Transaction History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <TransactionLog locationId={locationId} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {locationId && (
        <RecordTransactionDialog
          open={txnDialog.open}
          onOpenChange={(v) => setTxnDialog((d) => ({ ...d, open: v }))}
          locationId={locationId}
          preselectedEntry={txnDialog.entry}
          onSuccess={() => {
            queryClient.invalidateQueries({
              queryKey: getGetInventoryQueryKey({ locationId }),
            });
            queryClient.invalidateQueries({
              queryKey: getGetInventoryTransactionsQueryKey({ locationId }),
            });
          }}
        />
      )}
    </div>
  );
}
