import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetItems,
  useGetCategories,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useGetItemVariants,
  useCreateItemVariant,
  useUpdateVariant,
  useDeleteVariant,
  getGetItemsQueryKey,
  getGetItemVariantsQueryKey,
} from "@workspace/api-client-react";
import type {
  Item,
  ItemVariant,
  CreateItemBody,
  UpdateItemBody,
  CreateItemVariantBody,
  UpdateItemVariantBody,
} from "@workspace/api-client-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, MoreHorizontal, Search, Package, Layers } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const ITEM_TYPES = [
  { value: "product", label: "Product" },
  { value: "service", label: "Service" },
  { value: "ingredient", label: "Ingredient" },
  { value: "menu_item", label: "Menu Item" },
];

const TYPE_COLORS: Record<string, string> = {
  product: "bg-blue-100 text-blue-800",
  service: "bg-purple-100 text-purple-800",
  ingredient: "bg-orange-100 text-orange-800",
  menu_item: "bg-green-100 text-green-800",
};

function ItemFormDialog({
  open,
  onOpenChange,
  item,
  categories,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: Item;
  categories: { id: number; name: string }[];
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<{
    name: string;
    description: string;
    type: string;
    categoryId: string;
    basePrice: string;
    cost: string;
    trackInventory: boolean;
    hasVariants: boolean;
  }>({
    name: item?.name ?? "",
    description: item?.description ?? "",
    type: item?.type ?? "product",
    categoryId: item?.categoryId?.toString() ?? "none",
    basePrice: item?.basePrice ?? "",
    cost: item?.cost ?? "",
    trackInventory: item?.trackInventory ?? true,
    hasVariants: item?.hasVariants ?? false,
  });

  const { toast } = useToast();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const isEditing = !!item;

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      type: form.type as CreateItemBody["type"],
      categoryId: form.categoryId !== "none" ? parseInt(form.categoryId) : null,
      basePrice: form.basePrice || null,
      cost: form.cost || null,
      trackInventory: form.trackInventory,
      hasVariants: form.hasVariants,
    };
    try {
      if (isEditing) {
        await updateItem.mutateAsync({ id: item!.id, data: payload as UpdateItemBody });
        toast({ title: "Item updated" });
      } else {
        await createItem.mutateAsync({ data: payload });
        toast({ title: "Item created" });
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Error saving item", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Cheeseburger"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.basePrice}
                onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Track Inventory</p>
              <p className="text-xs text-muted-foreground">Monitor stock levels for this item</p>
            </div>
            <Switch
              checked={form.trackInventory}
              onCheckedChange={(v) => setForm((f) => ({ ...f, trackInventory: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Has Variants</p>
              <p className="text-xs text-muted-foreground">e.g. size, color, unit</p>
            </div>
            <Switch
              checked={form.hasVariants}
              onCheckedChange={(v) => setForm((f) => ({ ...f, hasVariants: v }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createItem.isPending || updateItem.isPending}
          >
            {isEditing ? "Save Changes" : "Create Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariantFormDialog({
  open,
  onOpenChange,
  variant,
  itemId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variant?: ItemVariant;
  itemId: number;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: variant?.name ?? "",
    sku: variant?.sku ?? "",
    price: variant?.price ?? "",
    cost: variant?.cost ?? "",
  });

  const { toast } = useToast();
  const createVariant = useCreateItemVariant();
  const updateVariant = useUpdateVariant();
  const isEditing = !!variant;

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Variant name is required", variant: "destructive" });
      return;
    }
    const payload: CreateItemVariantBody = {
      name: form.name.trim(),
      sku: form.sku || null,
      price: form.price || null,
      cost: form.cost || null,
    };
    try {
      if (isEditing) {
        await updateVariant.mutateAsync({ id: variant!.id, data: payload as UpdateItemVariantBody });
        toast({ title: "Variant updated" });
      } else {
        await createVariant.mutateAsync({ itemId, data: payload });
        toast({ title: "Variant added" });
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      toast({ title: "Error saving variant", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Variant" : "Add Variant"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Small, 1kg, Red"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>SKU</Label>
            <Input
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              placeholder="Optional stock keeping unit"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Price</Label>
              <Input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Cost</Label>
              <Input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createVariant.isPending || updateVariant.isPending}
          >
            {isEditing ? "Save Changes" : "Add Variant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariantsSheet({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: Item;
}) {
  const queryClient = useQueryClient();
  const { data: variants, isLoading } = useGetItemVariants(item.id, {
    query: { enabled: open, queryKey: getGetItemVariantsQueryKey(item.id) },
  });
  const deleteVariant = useDeleteVariant();
  const { toast } = useToast();
  const [variantDialog, setVariantDialog] = useState<{
    open: boolean;
    variant?: ItemVariant;
  }>({ open: false });

  const handleDelete = async (variantId: number) => {
    try {
      await deleteVariant.mutateAsync({ id: variantId });
      queryClient.invalidateQueries({ queryKey: getGetItemVariantsQueryKey(item.id) });
      toast({ title: "Variant deleted" });
    } catch {
      toast({ title: "Error deleting variant", variant: "destructive" });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Variants — {item.name}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4">
          <Button
            size="sm"
            onClick={() => setVariantDialog({ open: true })}
            className="self-start"
          >
            <Plus className="mr-1 h-4 w-4" /> Add Variant
          </Button>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : variants && variants.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{v.sku || "—"}</TableCell>
                    <TableCell>{v.price ? `$${v.price}` : "—"}</TableCell>
                    <TableCell>{v.cost ? `$${v.cost}` : "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setVariantDialog({ open: true, variant: v })}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(v.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
              <Layers className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No variants yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add variants like Small, Medium, Large or 1kg, 5kg
              </p>
            </div>
          )}
        </div>
      </SheetContent>
      <VariantFormDialog
        open={variantDialog.open}
        onOpenChange={(v) => setVariantDialog((d) => ({ ...d, open: v }))}
        variant={variantDialog.variant}
        itemId={item.id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: getGetItemVariantsQueryKey(item.id) });
        }}
      />
    </Sheet>
  );
}

export default function ItemsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const { data: items, isLoading } = useGetItems(
    {
      ...(search ? { search } : {}),
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(categoryFilter !== "all" ? { categoryId: parseInt(categoryFilter) } : {}),
      active: showInactive ? undefined : true,
    },
    { query: { queryKey: [...getGetItemsQueryKey({ search, type: typeFilter, categoryId: categoryFilter !== "all" ? parseInt(categoryFilter) : undefined })] } },
  );

  const { data: categories } = useGetCategories();
  const deleteItem = useDeleteItem();
  const updateItem = useUpdateItem();

  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: Item }>({
    open: false,
  });
  const [variantsSheet, setVariantsSheet] = useState<{ open: boolean; item?: Item }>({
    open: false,
  });

  const handleDelete = async (item: Item) => {
    try {
      await deleteItem.mutateAsync({ id: item.id });
      queryClient.invalidateQueries({ queryKey: getGetItemsQueryKey() });
      toast({ title: `"${item.name}" deleted` });
    } catch {
      toast({ title: "Error deleting item", variant: "destructive" });
    }
  };

  const handleToggleActive = async (item: Item) => {
    try {
      await updateItem.mutateAsync({ id: item.id, data: { active: !item.active } });
      queryClient.invalidateQueries({ queryKey: getGetItemsQueryKey() });
      toast({ title: item.active ? "Item deactivated" : "Item activated" });
    } catch {
      toast({ title: "Error updating item", variant: "destructive" });
    }
  };

  const formatPrice = (price: string | null | undefined) => {
    if (!price) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
      parseFloat(price),
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground">Manage your products, ingredients, and menu items.</p>
        </div>
        <Button onClick={() => setItemDialog({ open: true })}>
          <Plus className="mr-2 h-4 w-4" /> New Item
        </Button>
      </div>

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
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ITEM_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
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
              <Switch checked={showInactive} onCheckedChange={setShowInactive} id="show-inactive" />
              <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
                Show all
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !items || items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium">No items found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search || typeFilter !== "all" || categoryFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first item to get started"}
              </p>
              {!search && typeFilter === "all" && categoryFilter === "all" && (
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() => setItemDialog({ open: true })}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className={!item.active ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      {item.hasVariants && (
                        <div className="text-xs text-muted-foreground">Has variants</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[item.type] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {ITEM_TYPES.find((t) => t.value === item.type)?.label ?? item.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.categoryName ?? "—"}
                    </TableCell>
                    <TableCell>{formatPrice(item.basePrice)}</TableCell>
                    <TableCell>{formatPrice(item.cost)}</TableCell>
                    <TableCell>
                      <Badge variant={item.active ? "default" : "secondary"}>
                        {item.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setItemDialog({ open: true, item })}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setVariantsSheet({ open: true, item })}
                          >
                            <Layers className="mr-2 h-3.5 w-3.5" />
                            Manage Variants
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(item)}>
                            {item.active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(item)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ItemFormDialog
        open={itemDialog.open}
        onOpenChange={(v) => setItemDialog((d) => ({ ...d, open: v }))}
        item={itemDialog.item}
        categories={categories ?? []}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: getGetItemsQueryKey() })}
      />

      {variantsSheet.item && (
        <VariantsSheet
          open={variantsSheet.open}
          onOpenChange={(v) => setVariantsSheet((d) => ({ ...d, open: v }))}
          item={variantsSheet.item}
        />
      )}
    </div>
  );
}
