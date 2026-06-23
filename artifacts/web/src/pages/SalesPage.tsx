import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLocationContext } from "@/hooks/useLocation";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, orderTone } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { useCurrency } from "@/hooks/useCurrency";
import { Plus, Minus, Trash2, ShoppingCart, Printer, MessageCircle, CreditCard } from "lucide-react";

interface MenuVariant { itemId: string; itemName: string; categoryName: string | null; variantId: string; variantName: string; price: string | null; isAvailable: boolean }
interface Order { id: string; orderType: string; status: string; subtotal: string; tax: string; discount: string; total: string; currencyCode: string; customerId: string | null; createdAt: string; siigoInvoiceId: string | null; cufe: string | null; externalRef: string | null }
interface OrderLine { id: string; name: string; quantity: string; unitPrice: string; lineTotal: string }
interface Payment { id: string; method: string; amount: string; tip: string; processedAt: string; posSource: string; externalTransactionId: string | null }
interface Customer { id: string; name: string }
interface CartLine { variantId: string; name: string; unitPrice: number; quantity: number }

const ORDER_TYPES = ["dine_in", "pickup", "delivery", "retail"];
const PAYMENT_METHODS = ["cash", "card", "transfer", "nequi", "daviplata", "other"];
const TIP_RATE = 0.10; // 10% Colombian propina

const EMPTY_PAY = { method: "cash", amount: "", addTip: false, tip: "", notes: "" };

export function SalesPage() {
  const t = useT();
  const qc = useQueryClient();
  const { fmt, round, decimals } = useCurrency();
  const { activeLocationId, locations } = useLocationContext();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [orderType, setOrderType] = useState("dine_in");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addingItems, setAddingItems] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState(EMPTY_PAY);

  const TYPE_LABEL: Record<string, string> = {
    dine_in: t("sales.orderType.dineIn"),
    pickup: t("sales.orderType.pickup"),
    delivery: t("sales.orderType.delivery"),
    retail: t("sales.orderType.retail"),
    service: t("sales.orderType.service"),
  };
  const STATUS_LABEL: Record<string, string> = {
    pending: t("sales.status.pending"),
    confirmed: t("sales.status.confirmed"),
    in_progress: t("sales.status.inProgress"),
    ready: t("sales.status.ready"),
    completed: t("sales.status.completed"),
    cancelled: t("sales.status.cancelled"),
  };
  const METHOD_LABEL: Record<string, string> = {
    cash: t("sales.paymentMethod.cash"),
    card: t("sales.paymentMethod.card"),
    transfer: t("sales.paymentMethod.transfer"),
    nequi: t("sales.paymentMethod.nequi"),
    daviplata: t("sales.paymentMethod.daviplata"),
    other: t("sales.paymentMethod.other"),
  };

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
  const { data: detailPayments } = useQuery({
    queryKey: ["payments", detailId],
    queryFn: () => api.get(`/payments?orderId=${detailId}`).then((r) => r.data as Payment[]),
    enabled: !!detailId,
  });

  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";
  const customerName = (id: string | null) => (id ? customers?.find((c) => c.id === id)?.name ?? "Customer" : "—");

  function openBuilder() {
    if (!activeLocationId && locations.length > 1) {
      toast({ title: t("sales.locationToast.title"), description: t("sales.locationToast.description"), variant: "destructive" });
      return;
    }
    setCart([]);
    setCustomerId("");
    setOrderType("dine_in");
    setMenuSearch("");
    setBuilderOpen(true);
  }

  function openPayDialog() {
    if (!detail) return;
    // Round to the currency's precision so the prefill matches the displayed
    // total (e.g. COP shows no decimals: a 79.50 total prefills as 80).
    const suggested = round(parseFloat(detail.total)).toFixed(decimals);
    const tipAmt = round(parseFloat(detail.total) * TIP_RATE).toFixed(decimals);
    setPayForm({ method: "cash", amount: suggested, addTip: false, tip: tipAmt, notes: "" });
    setPayOpen(true);
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

  // Payment dialog computed values — all rounded to the currency's precision so
  // the math agrees with what's displayed (COP has no fractional pesos).
  const orderTotal = detail ? round(parseFloat(detail.total)) : 0;
  const tipAmount = payForm.addTip ? round(parseFloat(payForm.tip || "0")) : 0;
  const amountCollected = round(parseFloat(payForm.amount || "0"));
  const changeDue = Math.max(0, amountCollected - orderTotal - tipAmount);
  const isShort = amountCollected < orderTotal;

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
      toast({ title: t("sales.toast.created"), variant: "success" });
    },
    onError: (e) => toast({ title: t("sales.toast.couldntCreate"), description: errText(e), variant: "destructive" }),
  });

  const cancelOrder = useMutation({
    mutationFn: () => api.patch(`/orders/${detailId}/status`, { status: "cancelled" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", detailId] });
      setConfirmCancel(false);
      toast({ title: t("sales.toast.cancelled"), variant: "success" });
    },
    onError: (e) => {
      setConfirmCancel(false);
      toast({ title: t("sales.toast.couldntCancel"), description: errText(e), variant: "destructive" });
    },
  });

  const recordPayment = useMutation({
    mutationFn: () =>
      api.post("/payments", {
        orderId: detailId,
        amount: round(parseFloat(payForm.amount)).toFixed(2),
        tip: payForm.addTip ? round(parseFloat(payForm.tip || "0")).toFixed(2) : "0",
        method: payForm.method,
        notes: payForm.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", detailId] });
      qc.invalidateQueries({ queryKey: ["payments", detailId] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setPayOpen(false);
      toast({ title: t("sales.toast.paymentRecorded"), variant: "success" });
    },
    onError: (e) => toast({ title: t("sales.toast.couldntPayment"), description: errText(e), variant: "destructive" }),
  });

  const addLineToOrder = useMutation({
    mutationFn: (v: MenuVariant) =>
      api.post(`/orders/${detailId}/lines`, {
        lines: [{ variantId: v.variantId, name: v.itemName + (v.variantName && v.variantName !== "Default" ? ` · ${v.variantName}` : ""), quantity: "1", unitPrice: v.price ?? "0" }],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", detailId] });
      toast({ title: t("sales.toast.itemAdded"), variant: "success" });
    },
    onError: (e) => toast({ title: t("sales.toast.couldntAddItem"), description: errText(e), variant: "destructive" }),
  });

  const removeLineFromOrder = useMutation({
    mutationFn: (lineId: string) => api.delete(`/orders/${detailId}/lines/${lineId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", detailId] });
    },
    onError: (e) => toast({ title: t("sales.toast.couldntRemoveItem"), description: errText(e), variant: "destructive" }),
  });

  const noMenu = (menu ?? []).length === 0;
  const terminal = detail && (detail.status === "completed" || detail.status === "cancelled");
  const payment = detailPayments?.[0];

  function buildWhatsAppText() {
    if (!detail) return "";
    const biz = "Restaurante";
    const lines = (detail.lines ?? []).map((l) =>
      `  ${parseFloat(l.quantity)}x ${l.name} — ${formatCurrency(l.lineTotal, detail.currencyCode)}`
    ).join("\n");
    const tip = payment ? parseFloat(payment.tip) : 0;
    const total = parseFloat(detail.total) + tip;
    const method = payment ? METHOD_LABEL[payment.method] ?? payment.method : "";
    return encodeURIComponent(
      `*${biz}*\nRecibo\n\n${lines}\n\nSubtotal: ${formatCurrency(detail.subtotal, detail.currencyCode)}\n` +
      (parseFloat(detail.tax) > 0 ? `Impuesto: ${formatCurrency(detail.tax, detail.currencyCode)}\n` : "") +
      (tip > 0 ? `Propina: ${formatCurrency(tip, detail.currencyCode)}\n` : "") +
      `*TOTAL: ${formatCurrency(total, detail.currencyCode)}*\n` +
      (method ? `Pago: ${method}\n` : "") +
      `\n¡Gracias por su visita!`
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("sales.title")}</h1>
          <p className="text-sm text-slate-500">{t("sales.subtitle")}</p>
        </div>
        <Button onClick={openBuilder}>
          <Plus className="mr-1 h-4 w-4" /> {t("sales.btn.newSale")}
        </Button>
      </div>

      {isLoading ? null : (orders ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={ShoppingCart}
          title={noMenu ? t("sales.emptyState.noMenu.title") : t("sales.emptyState.hasMenu.title")}
          description={noMenu ? t("sales.emptyState.noMenu.description") : t("sales.emptyState.hasMenu.description")}
          actionLabel={noMenu ? t("sales.emptyState.noMenu.actionLabel") : t("sales.emptyState.hasMenu.actionLabel")}
          actionHref={noMenu ? "/dashboard/menu" : undefined}
          onAction={noMenu ? undefined : openBuilder}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("sales.table.col.when")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("sales.table.col.customer")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("sales.table.col.type")}</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">{t("sales.table.col.total")}</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">{t("sales.table.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((o) => (
                  <tr key={o.id} onClick={() => setDetailId(o.id)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(o.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{customerName(o.customerId)}</td>
                    <td className="px-4 py-3 text-slate-500">{TYPE_LABEL[o.orderType] ?? o.orderType}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(o.total, o.currencyCode)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge tone={orderTone(o.status)}>{STATUS_LABEL[o.status] ?? o.status}</StatusBadge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Order builder ── */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("sales.builderDialog.title")}</DialogTitle>
          </DialogHeader>
          {noMenu ? (
            <div className="py-6">
              <GuidedEmptyState icon={ShoppingCart} title={t("sales.builderDialog.noMenu.title")} description={t("sales.builderDialog.noMenu.description")} actionLabel={t("sales.builderDialog.noMenu.actionLabel")} actionHref="/dashboard/menu" />
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Input placeholder={t("sales.builderDialog.search.placeholder")} value={menuSearch} onChange={(e) => setMenuSearch(e.target.value)} />
                <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  {filteredMenu.map((v) => (
                    <button
                      key={v.variantId}
                      disabled={!v.isAvailable}
                      onClick={() => addToCart(v)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        v.isAvailable
                          ? "border-slate-200 hover:border-slate-900 hover:bg-slate-50"
                          : "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className={`font-medium ${v.isAvailable ? "text-slate-900" : "text-slate-400"}`}>
                        {v.itemName}
                        {v.variantName && v.variantName !== "Default" ? <span className="text-slate-500"> · {v.variantName}</span> : null}
                        {!v.isAvailable && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">{t("sales.builderDialog.soldOut")}</span>}
                      </div>
                      <div className="text-xs text-slate-500">{v.price ? fmt(v.price) : "—"}</div>
                    </button>
                  ))}
                  {filteredMenu.length === 0 && <p className="px-1 py-4 text-sm text-slate-400">{t("sales.builderDialog.menu.noMatches")}</p>}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200">
                {cart.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">{t("sales.builderDialog.cart.empty")}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {cart.map((c) => (
                      <div key={c.variantId} className="flex items-center gap-3 px-3 py-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-slate-500">{fmt(c.unitPrice)} {t("sales.builderDialog.each")}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(c.variantId, c.quantity - 1)}><Minus className="h-3 w-3" /></Button>
                          <span className="w-6 text-center text-sm">{c.quantity}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(c.variantId, c.quantity + 1)}><Plus className="h-3 w-3" /></Button>
                        </div>
                        <span className="w-20 text-right text-sm font-medium">{fmt(c.unitPrice * c.quantity)}</span>
                        <button onClick={() => setQty(c.variantId, 0)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("sales.builderDialog.label.customer")}</Label>
                  <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t("sales.builderDialog.customer.walkin")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("sales.builderDialog.customer.walkin")}</SelectItem>
                      {(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("sales.builderDialog.label.orderType")}</Label>
                  <Select value={orderType} onValueChange={setOrderType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORDER_TYPES.map((tp) => <SelectItem key={tp} value={tp}>{TYPE_LABEL[tp]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm text-slate-500">{t("sales.builderDialog.summary.total")}</span>
                <span className="text-lg font-bold">{fmt(cartTotal)}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setBuilderOpen(false)}>{t("sales.builderDialog.btn.cancel")}</Button>
                <Button disabled={cart.length === 0 || createOrder.isPending} onClick={() => createOrder.mutate()}>
                  {createOrder.isPending ? t("sales.builderDialog.btn.saving") : t("sales.builderDialog.btn.create")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Order detail ── */}
      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) { setDetailId(null); setPayOpen(false); setAddingItems(false); setAddSearch(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t("sales.detailDialog.title")}
              {detail ? <StatusBadge tone={orderTone(detail.status)}>{STATUS_LABEL[detail.status] ?? detail.status}</StatusBadge> : null}
              {payment ? (
                <Badge variant="secondary" className="gap-1">
                  <CreditCard className="h-3 w-3" />
                  {METHOD_LABEL[payment.method] ?? payment.method}
                  {payment.posSource === "pos_sync" ? " · POS" : payment.posSource === "siigo_sync" ? " · Siigo" : ""}
                </Badge>
              ) : null}
              {detail?.cufe ? (
                <Badge variant="outline" className="font-mono text-[10px] text-green-700 border-green-300 max-w-[120px] truncate" title={`CUFE: ${detail.cufe}`}>
                  CUFE ✓
                </Badge>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>{customerName(detail.customerId)} · {TYPE_LABEL[detail.orderType] ?? detail.orderType}</span>
                <span>{formatDateTime(detail.createdAt)}</span>
              </div>

              {detail.cufe && (
                <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
                  <span className="font-semibold">CUFE DIAN:</span>{" "}
                  <span className="font-mono break-all">{detail.cufe}</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {(detail.lines ?? []).map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{parseFloat(l.quantity)}× {l.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">{formatCurrency(l.lineTotal, detail.currencyCode)}</span>
                      {!terminal && (detail.lines ?? []).length > 1 && (
                        <button
                          onClick={() => removeLineFromOrder.mutate(l.id)}
                          className="text-slate-300 hover:text-red-500"
                          aria-label={t("sales.detailDialog.removeLine")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add items to an open order */}
              {!terminal && (
                addingItems ? (
                  <div className="space-y-2 rounded-lg border border-slate-200 p-2">
                    <Input
                      autoFocus
                      placeholder={t("sales.builderDialog.search.placeholder")}
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                    />
                    <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                      {(menu ?? [])
                        .filter((v) => v.isAvailable && v.itemName.toLowerCase().includes(addSearch.toLowerCase()))
                        .map((v) => (
                          <button
                            key={v.variantId}
                            disabled={addLineToOrder.isPending}
                            onClick={() => addLineToOrder.mutate(v)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-left text-sm hover:border-slate-900 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <span className="font-medium text-slate-900">{v.itemName}</span>
                            <span className="ml-2 text-xs text-slate-500">{v.price ? fmt(v.price) : "—"}</span>
                          </button>
                        ))}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => { setAddingItems(false); setAddSearch(""); }}>
                      {t("sales.detailDialog.doneAdding")}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setAddingItems(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> {t("sales.detailDialog.addItems")}
                  </Button>
                )
              )}

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-500"><span>{t("sales.detailDialog.summary.subtotal")}</span><span>{formatCurrency(detail.subtotal, detail.currencyCode)}</span></div>
                {parseFloat(detail.discount) > 0 && <div className="flex justify-between text-slate-500"><span>{t("sales.detailDialog.summary.discount")}</span><span>−{formatCurrency(detail.discount, detail.currencyCode)}</span></div>}
                {parseFloat(detail.tax) > 0 && <div className="flex justify-between text-slate-500"><span>{t("sales.detailDialog.summary.tax")}</span><span>{formatCurrency(detail.tax, detail.currencyCode)}</span></div>}
                {payment && parseFloat(payment.tip) > 0 && (
                  <div className="flex justify-between text-slate-500"><span>{t("sales.detailDialog.summary.propina")}</span><span>{formatCurrency(payment.tip, detail.currencyCode)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold">
                  <span>{t("sales.detailDialog.summary.total")}</span>
                  <span>{formatCurrency(payment ? (parseFloat(detail.total) + parseFloat(payment.tip)).toFixed(2) : detail.total, detail.currencyCode)}</span>
                </div>
              </div>

              {/* Completed order — receipt & WhatsApp */}
              {terminal && payment && (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(`/api/v1/receipts/${detail.id}`, "_blank")}
                  >
                    <Printer className="mr-1.5 h-4 w-4" /> {t("sales.detailDialog.btn.printReceipt")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => window.open(`https://wa.me/?text=${buildWhatsAppText()}`, "_blank")}
                  >
                    <MessageCircle className="mr-1.5 h-4 w-4" /> {t("sales.detailDialog.btn.whatsapp")}
                  </Button>
                </div>
              )}

              {/* Active order — action buttons */}
              {!terminal && (
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmCancel(true)}>
                    {t("sales.detailDialog.btn.cancelOrder")}
                  </Button>
                  <Button onClick={openPayDialog}>
                    <CreditCard className="mr-1.5 h-4 w-4" /> {t("sales.detailDialog.btn.takePayment")}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-slate-400">{t("sales.detailDialog.loading")}</div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Payment dialog ── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sales.payDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("sales.payDialog.label.method")}</Label>
              <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{METHOD_LABEL[m] ?? m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("sales.payDialog.label.amount")}</Label>
              <Input
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                inputMode="decimal"
                placeholder={orderTotal.toFixed(decimals)}
              />
              {payForm.method === "cash" && amountCollected > 0 && !isShort && (
                <p className="text-sm text-slate-600">
                  {t("sales.payDialog.changeDue")} <span className="font-semibold">{formatCurrency(changeDue, detail?.currencyCode)}</span>
                </p>
              )}
              {isShort && amountCollected > 0 && (
                <p className="text-sm text-red-600">
                  {t("sales.payDialog.shortBy", { amount: formatCurrency(orderTotal - amountCollected, detail?.currencyCode) })}
                </p>
              )}
            </div>

            <div className="rounded-lg border border-slate-100 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("sales.payDialog.addPropina")}</span>
                <button
                  onClick={() => setPayForm((f) => ({ ...f, addTip: !f.addTip }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${payForm.addTip ? "bg-slate-900" : "bg-slate-200"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${payForm.addTip ? "translate-x-4" : "translate-x-1"}`} />
                </button>
              </div>
              {payForm.addTip && (
                <div className="space-y-1">
                  <Input
                    value={payForm.tip}
                    onChange={(e) => setPayForm({ ...payForm, tip: e.target.value })}
                    inputMode="decimal"
                  />
                  <Hint>{t("sales.payDialog.propina.hint")}</Hint>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between text-slate-500"><span>{t("sales.payDialog.summary.orderTotal")}</span><span>{formatCurrency(orderTotal, detail?.currencyCode)}</span></div>
              {payForm.addTip && <div className="flex justify-between text-slate-500"><span>{t("sales.payDialog.summary.propina")}</span><span>{formatCurrency(parseFloat(payForm.tip || "0"), detail?.currencyCode)}</span></div>}
              <div className="flex justify-between font-bold border-t border-slate-200 pt-1"><span>{t("sales.payDialog.summary.grandTotal")}</span><span>{formatCurrency(orderTotal + tipAmount, detail?.currencyCode)}</span></div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("sales.payDialog.label.notes")}</Label>
              <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder={t("sales.payDialog.notes.placeholder")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setPayOpen(false)}>{t("sales.payDialog.btn.cancel")}</Button>
            <Button
              disabled={!payForm.amount || isShort || recordPayment.isPending}
              onClick={() => recordPayment.mutate()}
            >
              {recordPayment.isPending ? t("sales.payDialog.btn.processing") : t("sales.payDialog.btn.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("sales.cancelDialog.title")}
        description={t("sales.cancelDialog.description")}
        confirmLabel={t("sales.cancelDialog.confirmLabel")}
        destructive
        loading={cancelOrder.isPending}
        onConfirm={() => cancelOrder.mutate()}
      />
    </div>
  );
}
