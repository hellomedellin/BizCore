import { useState, useEffect } from "react";
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
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useGetRecipe,
  useUpsertRecipe,
  getGetItemsQueryKey,
  getGetItemVariantsQueryKey,
  getGetCategoriesQueryKey,
  getGetRecipeQueryKey,
} from "@workspace/api-client-react";
import type {
  Item,
  ItemVariant,
  Category,
  CreateItemBody,
  UpdateItemBody,
  CreateItemVariantBody,
  UpdateItemVariantBody,
  CreateCategoryBody,
  UpsertRecipeBody,
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
import { Plus, MoreHorizontal, Search, Package, Layers, BookOpen, FolderOpen, Trash2, Pencil, ChefHat } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntityCustomFields } from "@/components/use-entity-custom-fields";
import { CustomFieldsSection } from "@/components/custom-fields-section";

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

function CategoryManagerSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categories, isLoading } = useGetCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [catDialog, setCatDialog] = useState<{
    open: boolean;
    category?: Category;
    name: string;
  }>({ open: false, name: "" });

  const handleSaveCategory = async () => {
    if (!catDialog.name.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }
    try {
      if (catDialog.category) {
        await updateCategory.mutateAsync({ id: catDialog.category.id, data: { name: catDialog.name.trim() } });
        toast({ title: "Category updated" });
      } else {
        await createCategory.mutateAsync({ data: { name: catDialog.name.trim() } as CreateCategoryBody });
        toast({ title: "Category created" });
      }
      queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      setCatDialog({ open: false, name: "" });
    } catch {
      toast({ title: "Error saving category", variant: "destructive" });
    }
  };

  const handleDelete = async (cat: Category) => {
    try {
      await deleteCategory.mutateAsync({ id: cat.id });
      queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetItemsQueryKey() });
      toast({ title: `"${cat.name}" deleted` });
    } catch {
      toast({ title: "Error deleting category", variant: "destructive" });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Manage Categories
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            <Button
              size="sm"
              onClick={() => setCatDialog({ open: true, name: "" })}
              className="self-start"
            >
              <Plus className="mr-1 h-4 w-4" /> New Category
            </Button>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !categories || categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No categories yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCatDialog({ open: true, category: cat, name: cat.name })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(cat)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={catDialog.open} onOpenChange={(v) => setCatDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{catDialog.category ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Name *</Label>
              <Input
                value={catDialog.name}
                onChange={(e) => setCatDialog((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Burgers, Drinks, Sides"
                onKeyDown={(e) => e.key === "Enter" && handleSaveCategory()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog((d) => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              {catDialog.category ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecipeEditor({ item }: { item: Item }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: recipeData, isLoading: recipeLoading } = useGetRecipe(item.id, {
    query: {
      queryKey: getGetRecipeQueryKey(item.id),
      retry: false,
    },
  });
  const { data: ingredients } = useGetItems({ type: "ingredient" });
  const upsertRecipe = useUpsertRecipe();

  const [addDialog, setAddDialog] = useState<{
    open: boolean;
    ingredientItemId: string;
    variantId: string;
    quantity: string;
    unit: string;
  }>({ open: false, ingredientItemId: "none", variantId: "none", quantity: "", unit: "" });

  const { data: selectedIngredientVariants } = useGetItemVariants(
    addDialog.ingredientItemId !== "none" ? parseInt(addDialog.ingredientItemId) : 0,
    {
      query: {
        enabled: addDialog.ingredientItemId !== "none",
        queryKey: getGetItemVariantsQueryKey(
          addDialog.ingredientItemId !== "none" ? parseInt(addDialog.ingredientItemId) : 0
        ),
      },
    }
  );

  const currentItems = recipeData?.items ?? [];

  const handleAddIngredient = async () => {
    if (addDialog.variantId === "none") {
      toast({ title: "Select a variant", variant: "destructive" });
      return;
    }
    const qty = parseFloat(addDialog.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }
    const newItem = {
      ingredientVariantId: parseInt(addDialog.variantId),
      quantity: addDialog.quantity,
      unit: addDialog.unit || null,
    };
    const updatedItems = [...currentItems.map((ri) => ({
      ingredientVariantId: ri.ingredientVariantId,
      quantity: ri.quantity,
      unit: ri.unit ?? null,
    })), newItem];
    try {
      await upsertRecipe.mutateAsync({
        itemId: item.id,
        data: { items: updatedItems } as UpsertRecipeBody,
      });
      queryClient.invalidateQueries({ queryKey: getGetRecipeQueryKey(item.id) });
      toast({ title: "Ingredient added" });
      setAddDialog({ open: false, ingredientItemId: "none", variantId: "none", quantity: "", unit: "" });
    } catch {
      toast({ title: "Error saving recipe", variant: "destructive" });
    }
  };

  const handleRemoveIngredient = async (ingredientVariantId: number) => {
    const updatedItems = currentItems
      .filter((ri) => ri.ingredientVariantId !== ingredientVariantId)
      .map((ri) => ({
        ingredientVariantId: ri.ingredientVariantId,
        quantity: ri.quantity,
        unit: ri.unit ?? null,
      }));
    try {
      await upsertRecipe.mutateAsync({
        itemId: item.id,
        data: { items: updatedItems } as UpsertRecipeBody,
      });
      queryClient.invalidateQueries({ queryKey: getGetRecipeQueryKey(item.id) });
      toast({ title: "Ingredient removed" });
    } catch {
      toast({ title: "Error updating recipe", variant: "destructive" });
    }
  };

  if (recipeLoading) {
    return <div className="space-y-2 mt-2">{[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {currentItems.length === 0
            ? "No ingredients yet. Add the components that make up this menu item."
            : `${currentItems.length} ingredient${currentItems.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={() => setAddDialog((d) => ({ ...d, open: true }))}>
          <Plus className="mr-1 h-4 w-4" /> Add Ingredient
        </Button>
      </div>
      {currentItems.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingredient</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentItems.map((ri) => (
              <TableRow key={ri.ingredientVariantId}>
                <TableCell className="font-medium text-sm">{ri.ingredientName}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{ri.variantName}</TableCell>
                <TableCell className="font-mono text-sm">{ri.quantity}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{ri.unit || "—"}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveIngredient(ri.ingredientVariantId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={addDialog.open} onOpenChange={(v) => setAddDialog((d) => ({ ...d, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Ingredient</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Ingredient Item *</Label>
              <Select
                value={addDialog.ingredientItemId}
                onValueChange={(v) => setAddDialog((d) => ({ ...d, ingredientItemId: v, variantId: "none" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ingredient..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select ingredient...</SelectItem>
                  {ingredients?.map((ing) => (
                    <SelectItem key={ing.id} value={ing.id.toString()}>{ing.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addDialog.ingredientItemId !== "none" && (
              <div className="grid gap-1.5">
                <Label>Variant *</Label>
                <Select
                  value={addDialog.variantId}
                  onValueChange={(v) => setAddDialog((d) => ({ ...d, variantId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select variant..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select variant...</SelectItem>
                    {selectedIngredientVariants?.map((v) => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
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
                  min="0"
                  value={addDialog.quantity}
                  onChange={(e) => setAddDialog((d) => ({ ...d, quantity: e.target.value }))}
                  placeholder="e.g. 0.2"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Unit</Label>
                <Input
                  value={addDialog.unit}
                  onChange={(e) => setAddDialog((d) => ({ ...d, unit: e.target.value }))}
                  placeholder="e.g. kg, l, pcs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog((d) => ({ ...d, open: false }))}>
              Cancel
            </Button>
            <Button onClick={handleAddIngredient} disabled={upsertRecipe.isPending}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

  const { fields: cfFields, values: cfValues, setFieldValue: cfSet, save: cfSave, reset: cfReset } =
    useEntityCustomFields("item", item?.id);

  useEffect(() => {
    if (!open) cfReset();
  }, [open]);

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
      let entityId: number;
      if (isEditing) {
        await updateItem.mutateAsync({ id: item!.id, data: payload as UpdateItemBody });
        entityId = item!.id;
        toast({ title: "Item updated" });
      } else {
        const created = await createItem.mutateAsync({ data: payload });
        entityId = created.id;
        toast({ title: "Item created" });
      }
      if (cfFields.length > 0) await cfSave(entityId);
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
          <CustomFieldsSection
            fields={cfFields}
            values={cfValues}
            onChange={cfSet}
          />
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
    attributes: variant?.attributes ? JSON.stringify(variant.attributes, null, 2) : "",
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
    let parsedAttributes: Record<string, unknown> | null = null;
    if (form.attributes.trim()) {
      try {
        parsedAttributes = JSON.parse(form.attributes.trim());
        if (typeof parsedAttributes !== "object" || Array.isArray(parsedAttributes)) {
          toast({ title: "Attributes must be a JSON object (e.g. {\"size\": \"M\"})", variant: "destructive" });
          return;
        }
      } catch {
        toast({ title: "Attributes contain invalid JSON", variant: "destructive" });
        return;
      }
    }
    const payload: CreateItemVariantBody = {
      name: form.name.trim(),
      sku: form.sku || null,
      price: form.price || null,
      cost: form.cost || null,
      attributes: parsedAttributes,
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
          <div className="grid gap-1.5">
            <Label>Attributes</Label>
            <Textarea
              value={form.attributes}
              onChange={(e) => setForm((f) => ({ ...f, attributes: e.target.value }))}
              placeholder={'{\n  "size": "M",\n  "color": "red"\n}'}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Optional JSON object for size, color, unit, or other properties.
            </p>
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

  const showRecipeTab = item.type === "menu_item";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {item.name}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <Tabs defaultValue="variants">
            <TabsList className={showRecipeTab ? "grid w-full grid-cols-2" : ""}>
              <TabsTrigger value="variants" className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Variants
              </TabsTrigger>
              {showRecipeTab && (
                <TabsTrigger value="recipe" className="flex items-center gap-1.5">
                  <ChefHat className="h-3.5 w-3.5" /> Recipe
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="variants" className="mt-4 flex flex-col gap-4">
              <Button
                size="sm"
                onClick={() => setVariantDialog({ open: true })}
                className="self-start"
              >
                <Plus className="mr-1 h-4 w-4" /> Add Variant
              </Button>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
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
                              <DropdownMenuItem onClick={() => setVariantDialog({ open: true, variant: v })}>
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
            </TabsContent>

            {showRecipeTab && (
              <TabsContent value="recipe" className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Define the ingredients that make up this menu item.
                  </p>
                </div>
                <RecipeEditor item={item} />
              </TabsContent>
            )}
          </Tabs>
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
  const [categoriesSheet, setCategoriesSheet] = useState(false);

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCategoriesSheet(true)}>
            <FolderOpen className="mr-2 h-4 w-4" /> Categories
          </Button>
          <Button onClick={() => setItemDialog({ open: true })}>
            <Plus className="mr-2 h-4 w-4" /> New Item
          </Button>
        </div>
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

      <CategoryManagerSheet
        open={categoriesSheet}
        onOpenChange={setCategoriesSheet}
      />
    </div>
  );
}
