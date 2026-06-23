import { useState, useMemo } from "react";
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
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { Carrot, Search, Truck, Plus, Info } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Link } from "wouter";
import { useCurrency } from "@/hooks/useCurrency";

interface Ingredient {
  id: string;
  name: string;
  cost: string | null;
  description: string | null;
  unitId: string | null;
}

interface Unit { id: string; name: string; abbreviation: string; unitType: string }

interface Level {
  itemId: string;
  variantId: string;
  quantity: string;
  lowStockThreshold: string | null;
  unitId: string | null;
  unitAbbreviation: string | null;
  isLowStock: boolean;
}

interface Row {
  ingredient: Ingredient;
  level: Level | null;
}

const EMPTY_FORM = { name: "", cost: "", description: "", unitId: "" };

export function IngredientsPage() {
  const t = useT();
  const qc = useQueryClient();
  const { activeLocationId } = useLocationContext();
  const { fmt } = useCurrency();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [counting, setCounting] = useState<Row | null>(null);
  const [count, setCount] = useState("");
  const [threshold, setThreshold] = useState("");

  const errText = (e: any) => e?.response?.data?.error ?? t("common.error");

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["items", "ingredient"],
    queryFn: () =>
      api.get("/items?active=true").then((r) =>
        (r.data as any[])
          .filter((i) => i.type === "resource")
          .map((i): Ingredient => ({
            id: i.id,
            name: i.name,
            cost: i.cost ?? null,
            description: i.description ?? null,
            unitId: i.unitId ?? null,
          }))
      ),
  });

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: () => api.get("/units").then((r) => (r.data as Unit[]).filter((u) => u.unitType !== "time")),
  });

  const { data: levels, isLoading: levelsLoading } = useQuery({
    queryKey: ["stock-levels", activeLocationId],
    queryFn: () =>
      api.get(`/inventory/levels?locationId=${activeLocationId}`).then((r) => r.data as Level[]),
    enabled: !!activeLocationId,
  });

  const isLoading = itemsLoading || (!!activeLocationId && levelsLoading);

  // ── merge ingredients + stock levels ──────────────────────────────────────
  const levelMap = useMemo(() => {
    const m = new Map<string, Level>();
    for (const l of levels ?? []) m.set(l.itemId, l);
    return m;
  }, [levels]);

  const rows: Row[] = useMemo(() => {
    return (items ?? []).map((ing) => ({
      ingredient: ing,
      level: levelMap.get(ing.id) ?? null,
    }));
  }, [items, levelMap]);

  const filtered = rows.filter((r) =>
    r.ingredient.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── mutations ─────────────────────────────────────────────────────────────
  const create = useMutation({
    mutationFn: () =>
      api.post("/items", {
        name: form.name.trim(),
        type: "resource",
        cost: form.cost || null,
        description: form.description || null,
        unitId: form.unitId || null,
        trackInventory: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast({ title: t("ingredient.toast.added"), variant: "success" });
    },
    onError: (e) => toast({ title: t("common.error"), description: errText(e), variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/items/${editing!.id}`, {
        name: form.name.trim(),
        cost: form.cost || null,
        description: form.description || null,
        unitId: form.unitId || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      setEditing(null);
      toast({ title: t("ingredient.toast.saved"), variant: "success" });
    },
    onError: (e) => toast({ title: t("common.error"), description: errText(e), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => api.patch(`/items/${editing!.id}`, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setConfirmRemove(false);
      setEditing(null);
      toast({ title: t("ingredient.toast.removed"), variant: "success" });
    },
    onError: (e) => {
      setConfirmRemove(false);
      toast({ title: t("common.error"), description: errText(e), variant: "destructive" });
    },
  });

  const setCountM = useMutation({
    mutationFn: async () => {
      const row = counting!;
      const current = parseFloat(row.level?.quantity ?? "0");
      const target = parseFloat(count || "0");
      const delta = (target - current).toString();
      const promises: Promise<any>[] = [];

      if (delta !== "0") {
        promises.push(api.post("/inventory/adjust", {
          variantId: row.level!.variantId,
          locationId: activeLocationId,
          type: "adjust",
          quantityChange: delta,
          ...(row.level?.unitId ? { unitId: row.level.unitId } : {}),
          notes: "Stock count",
        }));
      }

      const existingThreshold = row.level?.lowStockThreshold ?? "";
      if (threshold !== existingThreshold) {
        promises.push(api.patch("/inventory/threshold", {
          variantId: row.level!.variantId,
          locationId: activeLocationId,
          lowStockThreshold: threshold || null,
        }));
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-levels"] });
      setCounting(null);
      toast({ title: t("stock.toast.updated"), variant: "success" });
    },
    onError: (e) => toast({ title: t("stock.toast.couldntUpdate"), description: errText(e), variant: "destructive" }),
  });

  // ── helpers ───────────────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM);
    setCreateOpen(true);
  }

  function openEdit(ing: Ingredient) {
    setForm({ name: ing.name, cost: ing.cost ?? "", description: ing.description ?? "", unitId: ing.unitId ?? "" });
    setEditing(ing);
  }

  function openCount(row: Row) {
    setCount(row.level?.quantity ?? "0");
    setThreshold(row.level?.lowStockThreshold ?? "");
    setCounting(row);
  }

  const showStock = !!activeLocationId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("ingredient.title")}</h1>
          <p className="text-sm text-slate-500">{t("ingredient.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/purchasing">
              <Truck className="mr-1.5 h-4 w-4" />{t("stock.btn.receiveDelivery")}
            </Link>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />{t("ingredient.addLabel")}
          </Button>
        </div>
      </div>

      {/* No location banner */}
      {!showStock && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{t("ingredient.noLocationBanner")}</span>
        </div>
      )}

      {/* Low stock warning banner */}
      {showStock && (() => {
        const lowCount = rows.filter((r) => r.level?.isLowStock).length;
        if (!lowCount) return null;
        return (
          <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{t("ingredient.lowStockBanner", { count: String(lowCount) })}</span>
          </div>
        );
      })()}

      {isLoading ? null : (items ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={Carrot}
          title={t("ingredient.emptyTitle")}
          description={t("ingredient.emptyDesc")}
          actionLabel={t("ingredient.addLabel")}
          onAction={openCreate}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder={t("ingredient.search.placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("ingredient.col.name")}</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-600">{t("ingredient.col.cost")}</th>
                  {showStock && (
                    <>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">{t("ingredient.col.onHand")}</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-600">{t("ingredient.col.status")}</th>
                      <th className="px-4 py-3" />
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const { ingredient: ing, level } = row;
                  const qty = level ? parseFloat(level.quantity) : null;
                  const unit = level?.unitAbbreviation ?? "";
                  return (
                    <tr
                      key={ing.id}
                      onClick={() => openEdit(ing)}
                      className={`cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${level?.isLowStock ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-4 py-3">
                        <p className={`font-medium ${level?.isLowStock ? "text-red-700" : "text-slate-900"}`}>{ing.name}</p>
                        {ing.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{ing.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                        {ing.cost ? fmt(ing.cost) : <span className="text-slate-300">—</span>}
                        {ing.cost && unit && <span className="text-slate-400 text-xs"> / {unit}</span>}
                      </td>
                      {showStock && (
                        <>
                          <td className={`px-4 py-3 text-right tabular-nums font-medium ${level?.isLowStock ? "text-red-700" : "text-slate-700"}`}>
                            {qty !== null
                              ? <>{qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2)}{unit && <span className={`text-xs ml-1 ${level?.isLowStock ? "text-red-400" : "text-slate-400"}`}>{unit}</span>}</>
                              : <span className="text-slate-300">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-center">
                            {level?.isLowStock
                              ? <Badge variant="warning">{t("stock.badge.low")}</Badge>
                              : qty !== null && qty > 0
                                ? <Badge variant="secondary">{t("stock.badge.ok")}</Badge>
                                : <span className="text-slate-300 text-xs">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {level && (
                              <Button size="sm" variant="outline" onClick={() => openCount(row)}>
                                {t("stock.btn.setCount")}
                              </Button>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={showStock ? 5 : 2} className="px-4 py-8 text-center text-slate-400">
                      {t("ingredient.noMatches")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("ingredient.createDialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("ingredient.form.name")} <span className="text-red-400">*</span></Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("ingredient.namePlaceholder")}
                onKeyDown={(e) => { if (e.key === "Enter" && form.name.trim()) create.mutate(); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("ingredient.form.cost")} <span className="text-slate-400 text-xs">({t("common.optional")})</span></Label>
                <Input
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("ingredient.form.unit")}</Label>
                <Select value={form.unitId || "none"} onValueChange={(v) => setForm({ ...form, unitId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder={t("ingredient.form.unitNone")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("ingredient.form.unitNone")}</SelectItem>
                    {(units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Hint>{t("ingredient.form.unitHint")}</Hint>
            <div className="space-y-1.5">
              <Label>{t("ingredient.form.description")} <span className="text-slate-400 text-xs">({t("common.optional")})</span></Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("ingredient.form.descriptionPlaceholder")}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
              <Button disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? t("common.saving") : t("ingredient.addLabel")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("ingredient.editDialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("ingredient.form.name")} <span className="text-red-400">*</span></Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("ingredient.form.cost")} <span className="text-slate-400 text-xs">({t("common.optional")})</span></Label>
                <Input
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("ingredient.form.unit")}</Label>
                <Select value={form.unitId || "none"} onValueChange={(v) => setForm({ ...form, unitId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder={t("ingredient.form.unitNone")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("ingredient.form.unitNone")}</SelectItem>
                    {(units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Hint>{t("ingredient.form.unitHint")}</Hint>
            <div className="space-y-1.5">
              <Label>{t("ingredient.form.description")} <span className="text-slate-400 text-xs">({t("common.optional")})</span></Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("ingredient.form.descriptionPlaceholder")}
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setConfirmRemove(true)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                {t("ingredient.editDialog.remove")}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
                <Button disabled={!form.name.trim() || update.isPending} onClick={() => update.mutate()}>
                  {update.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set count dialog */}
      <Dialog open={!!counting} onOpenChange={(o) => { if (!o) setCounting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {counting ? t("stock.countDialog.title", { itemName: counting.ingredient.name }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>
                {counting ? t("stock.countDialog.label.counted", { unit: counting.level?.unitAbbreviation ?? "" }) : ""}
              </Label>
              <Input
                autoFocus
                value={count}
                onChange={(e) => setCount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
              />
              <Hint>{t("stock.countDialog.hint")}</Hint>
            </div>
            <div className="space-y-1.5">
              <Label>{t("ingredient.threshold.label")} <span className="text-slate-400 text-xs">({t("common.optional")})</span></Label>
              <Input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                inputMode="decimal"
                placeholder={t("ingredient.threshold.placeholder")}
              />
              <Hint>{t("ingredient.threshold.hint")}</Hint>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCounting(null)}>{t("stock.countDialog.btn.cancel")}</Button>
              <Button disabled={setCountM.isPending} onClick={() => setCountM.mutate()}>
                {setCountM.isPending ? t("stock.countDialog.btn.saving") : t("stock.countDialog.btn.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("ingredient.confirmRemove.title", { name: editing?.name ?? "" })}
        description={t("ingredient.confirmRemove.description")}
        confirmLabel={t("ingredient.confirmRemove.confirmLabel")}
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
