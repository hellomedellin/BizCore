import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocationContext } from "@/hooks/useLocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";

interface MenuVariant { itemId: string; itemName: string; categoryName: string | null; variantId: string; variantName: string; price: string | null }
interface Order { id: string; orderType: string; status: string; subtotal: string; tax: string; discount: string; total: string; currencyCode: string; customerId: string | null; createdAt: string }
interface OrderLine { id: string; name: string; quantity: string; unitPrice: string; lineTotal: string }
interface Customer { id: string; name: string }
interface CartLine { variantId: string; name: string; unitPrice: number; quantity: number }

const ORDER_TYPES = ["dine_in", "pickup", "delivery", "retail"];
const TYPE_LABEL: Record<string, string> = { dine_in: "Dine-in", pickup: "Pickup", delivery: "Delivery", retail: "Retail", service: "Service" };
const STATUS_LABEL: Record<string, string> = { pending: "Pending", confirmed: "Confirmed", in_progress: "In progress", ready: "Ready", completed: "Completed", cancelled: "Cancelled" };
const statusVariant = (s: string): "success" | "secondary" | "warning" => (s === "completed" ? "success" : s === "cancelled" ? "secondary" : "warning");

export function SalesPage() {
  const qc = useQueryClient();
  const { activeLocationId, locations } = useLocationContext();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orderType, setOrderType] = useState("dine_in");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", activeLocationId],
    queryFn: () => api.get(`/orders${activeLocationId ? `?locationId=${activeLocationId}` : ""}`).then((r) => r.data as Order[]),
  });
  const { data: menu } = useQuery({ queryKey: ["menu"], queryFn: () => api.get("/items/menu").then((r) => r.data as MenuVariant[]) });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => api.get("/customers").then((r) => r.data as Customer[]) });
  const { data: detail } = useQuery({
    queryKey: ["order", detailId],
    queryFn: () => api.get(`/orders/${detailId}`).then((r) => r.data as Order & { lines: OrderLine[] }),
    enabled: !!detailId,
  });

  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";
  const customerName = (id: string | null) => (id ? customers?.find((c) => c.id === id)?.name ?? "Customer" : "—");

  function openBuilder() {
    if (!activeLocationId && locations.length > 1) {
      toast({ title: "Choose a location", description: "Pick a location at the top before taking an order.", variant: "destructive" });
      return;
    }
    setCart([]);
    setCustomerId("");
    setOrderType("dine_in");
    setMenuSearch("");
    setBuilderOpen(true);
  }

  function addToCart(v: MenuVariant) {
    setCart((prev) => {
      const ex = prev.find((c) => c.variantId === v.variantId);
      if (ex) return prev.map((c) => (c.variantId === v.variantId ? { ...c, quantity: c.quantity + 1 } : c));
      const label = v.variantName && v.variantName !== "Default" ? `${v.itemName} (${v.variantName})` : v.itemName;
      return [...prev, { variantId: v.variantId, name: label, unitPrice: parseFloat(v.price ?? "0"), quantity: 1 }];
    });
  }
  function setQty(variantId: string, qty: number) {
    setCart((prev) => (qty <= 0 ? prev.filter((c) => c.variantId !== variantId) : prev.map((c) => (c.variantId === variantId ? { ...c, quantity: qty } : c))));
  }
  const cartTotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const filteredMenu = (menu ?? []).filter((v) => v.itemName.toLowerCase().includes(menuSearch.toLowerCase()));

  const createOrder = useMutation({
    mutationFn: () =>
      api.post("/orders", {
        locationId: activeLocationId,
        customerId: customerId || null,
        orderType,
        lines: cart.map((c) => ({ variantId: c.variantId, name: c.name, quantity: String(c.quantity), unitPrice: c.unitPrice.toFixed(2) })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      setBuilderOpen(false);
      setCart([]);
      toast({ title: "Sale created", variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't create sale", description: errText(e), variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/orders/${detailId}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", detailId] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setConfirmCancel(false);
      toast({ title: "Order updated", variant: "success" });
    },
    onError: (e) => {
      setConfirmCancel(false);
      toast({ title: "Couldn't update", description: errText(e), variant: "destructive" });
    },
  });

  const noMenu = (menu ?? []).length === 0;
  const terminal = detail && (detail.status === "completed" || detail.status === "cancelled");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales</h1>
          <p className="text-sm text-slate-500">Take orders and complete them — completing a sale updates your stock.</p>
        </div>
        <Button onClick={openBuilder}>
          <Plus className="mr-1 h-4 w-4" /> New sale
        </Button>
      </div>

      {isLoading ? null : (orders ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={ShoppingCart}
          title="No sales yet"
          description={noMenu ? "Add a few menu items first, then you can take orders here." : "Take your first order — pick items, set quantities, and complete the sale."}
          actionLabel={noMenu ? "Go to Menu" : "New sale"}
          actionHref={noMenu ? "/dashboard/menu" : undefined}
          onAction={noMenu ? undefined : openBuilder}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">When</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">Total</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((o) => (
                  <tr key={o.id} onClick={() => setDetailId(o.id)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(o.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{customerName(o.customerId)}</td>
                    <td className="px-4 py-3 text-slate-500">{TYPE_LABEL[o.orderType] ?? o.orderType}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.total, o.currencyCode)}</td>
                    <td className="px-4 py-3 text-center"><Badge variant={statusVariant(o.status)}>{STATUS_LABEL[o.status] ?? o.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Order builder */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New sale</DialogTitle>
          </DialogHeader>
          {noMenu ? (
            <div className="py-6">
              <GuidedEmptyState icon={ShoppingCart} title="No menu items yet" description="Add dishes/drinks on the Menu first, then come back to take an order." actionLabel="Go to Menu" actionHref="/dashboard/menu" />
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Item picker */}
              <div className="space-y-2">
                <Input placeholder="Search the menu…" value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} />
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  {filteredMenu.map((v) => (
                    <button
                      key={v.variantId}
                      onClick={() => addToCart(v)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition-colors hover:border-slate-900 hover:bg-slate-50"
                    >
                      <div className="font-medium text-slate-900">
                        {v.itemName}
                        {v.variantName && v.variantName !== "Default" ? <span className="text-slate-500"> · {v.variantName}</span> : null}
                      </div>
                      <div className="text-xs text-slate-500">{v.price ? formatCurrency(v.price) : "—"}</div>
                    </button>
                  ))}
                  {filteredMenu.length === 0 && <p className="px-1 py-4 text-sm text-slate-400">No matches.</p>}
                </div>
              </div>

              {/* Cart */}
              <div className="rounded-lg border border-slate-200">
                {cart.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">Tap items above to add them to the order.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cart.map((c) => (
                      <div key={c.variantId} className="flex items-center gap-3 px-3 py-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-slate-500">{formatCurrency(c.unitPrice)} each</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(c.variantId, c.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                          <span className="w-6 text-center text-sm">{c.quantity}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(c.variantId, c.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                        <span className="w-20 text-right text-sm font-medium">{formatCurrency(c.unitPrice * c.quantity)}</span>
                        <button onClick={() => setQty(c.variantId, 0)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Customer</Label>
                  <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Walk-in" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Walk-in</SelectItem>
                      {(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Order type</Label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORDER_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-lg font-bold">{formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
                <Button disabled={cart.length === 0 || createOrder.isPending} onClick={() => createOrder.mutate()}>
                  {createOrder.isPending ? "Saving…" : "Create sale"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order detail */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Order
              {detail ? <Badge variant={statusVariant(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</Badge> : null}
            </DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>{customerName(detail.customerId)} · {TYPE_LABEL[detail.orderType] ?? detail.orderType}</span>
                <span>{formatDateTime(detail.createdAt)}</span>
              </div>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {(detail.lines ?? []).map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{parseFloat(l.quantity)}× {l.name}</span>
                    <span className="text-slate-600">{formatCurrency(l.lineTotal, detail.currencyCode)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(detail.subtotal, detail.currencyCode)}</span></div>
                {parseFloat(detail.discount) > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>−{formatCurrency(detail.discount, detail.currencyCode)}</span></div>}
                {parseFloat(detail.tax) > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatCurrency(detail.tax, detail.currencyCode)}</span></div>}
                <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold"><span>Total</span><span>{formatCurrency(detail.total, detail.currencyCode)}</span></div>
              </div>
              {!terminal && (
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmCancel(true)}>Cancel order</Button>
                  <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate("completed")}>
                    {setStatus.isPending ? "Working…" : "Complete sale"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel this order?"
        description="It will be marked cancelled. Stock is not deducted for cancelled orders."
        confirmLabel="Cancel order"
        destructive
        loading={setStatus.isPending}
        onConfirm={() => setStatus.mutate("cancelled")}
      />
    </div>
  );
}
