import { useState, useMemo } from "react";
import { useLocation as useWouterLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  useGetLocations,
  useGetCategories,
  useGetItems,
  useGetItemVariants,
  useCreateOrder,
  useAddOrderLine,
  getGetLocationsQueryKey,
  getGetCategoriesQueryKey,
  getGetItemsQueryKey,
  getGetItemVariantsQueryKey,
} from "@workspace/api-client-react";
import type { Item, ItemVariant, Category } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Plus, Minus, X, ChevronLeft, CreditCard, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CartLine = {
  key: string;
  itemId: number;
  variantId: number | null;
  name: string;
  price: string;
  quantity: number;
};

function formatPrice(price: string | null | undefined) {
  if (!price) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(parseFloat(price));
}

function ItemTile({ item, onSelect }: { item: Item; onSelect: (item: Item) => void }) {
  return (
    <button
      onClick={() => onSelect(item)}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-95 min-h-[100px]"
    >
      <div className="text-2xl">🍽️</div>
      <p className="font-semibold text-sm leading-tight">{item.name}</p>
      {item.basePrice && (
        <p className="text-xs text-muted-foreground">{formatPrice(item.basePrice)}</p>
      )}
    </button>
  );
}

function VariantPicker({
  item,
  variants,
  onPick,
  onClose,
}: {
  item: Item;
  variants: ItemVariant[];
  onPick: (variant: ItemVariant) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-2xl shadow-xl p-6 w-[340px] max-w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{item.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Select a variant:</p>
        <div className="grid gap-2">
          {variants.map((v) => (
            <button
              key={v.id}
              onClick={() => onPick(v)}
              className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm hover:border-primary hover:bg-accent transition-colors"
            >
              <span className="font-medium">{v.name ?? item.name}</span>
              <span className="text-muted-foreground">{formatPrice(v.price ?? item.basePrice)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function POSPage() {
  const [, navigate] = useWouterLocation();
  const { toast } = useToast();

  const [locationId, setLocationId] = useState<string>("none");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantPickerItem, setVariantPickerItem] = useState<Item | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { data: locations } = useGetLocations({
    query: { queryKey: getGetLocationsQueryKey() },
  });

  const { data: categories } = useGetCategories({
    query: { queryKey: getGetCategoriesQueryKey() },
  });

  const itemsParams = useMemo(() => ({
    active: true,
    ...(selectedCategory ? { categoryId: selectedCategory } : {}),
  }), [selectedCategory]);

  const { data: items } = useGetItems(itemsParams, {
    query: { queryKey: getGetItemsQueryKey(itemsParams) },
  });

  const { data: variantPickerVariants } = useGetItemVariants(
    variantPickerItem?.id ?? 0,
    {
      query: {
        enabled: variantPickerItem !== null,
        queryKey: getGetItemVariantsQueryKey(variantPickerItem?.id ?? 0),
      },
    }
  );

  const createOrder = useCreateOrder();
  const addLine = useAddOrderLine();

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, l) => sum + parseFloat(l.price) * l.quantity, 0);
  }, [cart]);

  function addToCart(name: string, price: string, itemId: number, variantId: number | null) {
    const key = `${itemId}-${variantId ?? "none"}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => l.key === key ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { key, itemId, variantId, name, price, quantity: 1 }];
    });
  }

  function handleItemSelect(item: Item) {
    if (!item.hasVariants) {
      addToCart(item.name, item.basePrice ?? "0", item.id, null);
      return;
    }
    setVariantPickerItem(item);
  }

  function handleVariantPick(variant: ItemVariant) {
    if (!variantPickerItem) return;
    const price = variant.price ?? variantPickerItem.basePrice ?? "0";
    const name = variant.name ? `${variantPickerItem.name} - ${variant.name}` : variantPickerItem.name;
    addToCart(name, price, variantPickerItem.id, variant.id);
    setVariantPickerItem(null);
  }

  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => l.key === key ? { ...l, quantity: l.quantity + delta } : l)
        .filter((l) => l.quantity > 0)
    );
  }

  async function handleCheckout() {
    if (locationId === "none") {
      toast({ title: "Select a location first", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Cart is empty", variant: "destructive" });
      return;
    }
    setIsCheckingOut(true);
    try {
      const order = await createOrder.mutateAsync({
        data: {
          locationId: parseInt(locationId),
          orderType: "dine_in",
          customerId: null,
        },
      });
      for (const line of cart) {
        await addLine.mutateAsync({
          orderId: order.id,
          data: {
            name: line.name,
            quantity: String(line.quantity),
            price: line.price,
            variantId: line.variantId ?? undefined,
          },
        });
      }
      setCart([]);
      toast({ title: `Order #${order.id} created`, description: "Order submitted successfully" });
      navigate(`/orders`);
    } catch {
      toast({ title: "Failed to submit order", variant: "destructive" });
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-sidebar">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-lg font-bold tracking-tight">POS</span>
        </div>
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select location" />
          </SelectTrigger>
          <SelectContent>
            {locations?.map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Category + Items */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto border-b px-4 py-2 bg-muted/30">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                selectedCategory === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border hover:bg-accent"
              )}
            >
              All
            </button>
            {categories?.map((cat: Category) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  selectedCategory === cat.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-background border hover:bg-accent"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Item Grid */}
          <ScrollArea className="flex-1 p-4">
            {!items || items.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                No items available
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {items.map((item) => (
                  <ItemTile key={item.id} item={item} onSelect={handleItemSelect} />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: Cart */}
        <div className="w-80 flex flex-col border-l bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold">Cart</span>
            {cart.length > 0 && (
              <Badge className="ml-auto">{cart.reduce((s, l) => s + l.quantity, 0)}</Badge>
            )}
          </div>

          <ScrollArea className="flex-1 px-4 py-2">
            {cart.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Tap items to add them
              </div>
            ) : (
              <div className="grid gap-3 py-2">
                {cart.map((line) => (
                  <div key={line.key} className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{line.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatPrice(line.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQty(line.key, -1)}
                        className="flex h-6 w-6 items-center justify-center rounded border hover:bg-accent"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{line.quantity}</span>
                      <button
                        onClick={() => updateQty(line.key, 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border hover:bg-accent"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="shrink-0 text-sm font-semibold w-16 text-right">
                      {formatPrice(String(parseFloat(line.price) * line.quantity))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-4 grid gap-3">
            <Separator />
            <div className="flex items-center justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatPrice(String(cartTotal))}</span>
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={handleCheckout}
              disabled={cart.length === 0 || isCheckingOut || locationId === "none"}
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Checkout
                </>
              )}
            </Button>
            {cart.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setCart([])}>
                Clear Cart
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Variant Picker Modal */}
      {variantPickerItem && variantPickerVariants && (
        <VariantPicker
          item={variantPickerItem}
          variants={variantPickerVariants}
          onPick={handleVariantPick}
          onClose={() => setVariantPickerItem(null)}
        />
      )}
    </div>
  );
}
