import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { RecipeEditor } from "@/components/RecipeEditor";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { useT } from "@/lib/i18n";
import { Plus, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Item {
  id: string;
  name: string;
  description: string | null;
  type: string;
  categoryId: string | null;
  categoryName: string | null;
  basePrice: string | null;
  cost: string | null;
  active: boolean;
}
interface Category {
  id: string;
  name: string;
}

type Kind = "menu" | "ingredient";

export interface ItemCatalogConfig {
  title: string;
  subtitle: string;
  addLabel: string;
  editLabel: string;
  icon: LucideIcon;
  types: string[];
  createType: string;
  amountLabel: string;
  amountField: "basePrice" | "cost";
  amountHint: string;
  emptyTitle: string;
  emptyDesc: string;
  namePlaceholder: string;
}

const EMPTY = { name: "", amount: "", categoryId: "", description: "" };

export function ItemCatalog({ kind, cfg }: { kind: Kind; cfg: ItemCatalogConfig }) {
  const t = useT();
  const qc = useQueryClient();
  const { fmt } = useCurrency();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: items, isLoading } = useQuery({
    queryKey: ["items", kind],
    queryFn: () => api.get("/items?active=true").then((r) => (r.data as Item[]).filter((i) => cfg.types.includes(i.type))),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get("/categories").then((r) => r.data as Category[]),
  });

  const filtered = (items ?? []).filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const errText = (e: any) => e?.response?.data?.error ?? t("common.error");

  const create = useMutation({
    mutationFn: () =>
      api.post("/items", {
        name: form.name.trim(),
        type: cfg.createType,
        categoryId: form.categoryId || null,
        description: form.description || null,
        [cfg.amountField]: form.amount || null,
        ...(kind === "ingredient" ? { trackInventory: true } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      setCreateOpen(false);
      setForm(EMPTY);
      toast({
        title: kind === "menu"
          ? t("itemCatalog.toast.added.menuItem")
          : t("itemCatalog.toast.added.ingredient"),
        variant: "success",
      });
    },
    onError: (e) => toast({ title: t("itemCatalog.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/items/${editing!.id}`, {
        name: form.name.trim(),
        categoryId: form.categoryId || null,
        description: form.description || null,
        [cfg.amountField]: form.amount || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      setEditing(null);
      toast({ title: t("itemCatalog.toast.saved"), variant: "success" });
    },
    onError: (e) => toast({ title: t("itemCatalog.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => api.patch(`/items/${editing!.id}`, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      setConfirmDelete(false);
      setEditing(null);
      toast({ title: t("itemCatalog.toast.removed"), variant: "success" });
    },
    onError: (e) => {
      setConfirmDelete(false);
      toast({ title: t("itemCatalog.toast.couldntRemove"), description: errText(e), variant: "destructive" });
    },
  });

  function openCreate() {
    setForm(EMPTY);
    setCreateOpen(true);
  }
  function openEdit(it: Item) {
    setForm({
      name: it.name,
      amount: (kind === "menu" ? it.basePrice : it.cost) ?? "",
      categoryId: it.categoryId ?? "",
      description: it.description ?? "",
    });
    setEditing(it);
  }

  function renderFields() {
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>{t("itemCatalog.form.label.name")}</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={cfg.namePlaceholder} />
        </div>
        <div className="space-y-1.5">
          <Label>{cfg.amountLabel}</Label>
          <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={t("itemCatalog.form.placeholder.amount")} inputMode="decimal" />
          <Hint>{cfg.amountHint}</Hint>
        </div>
        {kind === "menu" && (
          <div className="space-y-1.5">
            <Label>{t("itemCatalog.form.label.category")}</Label>
            <Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}>
              <SelectTrigger>
                <SelectValue placeholder={t("itemCatalog.form.category.none")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("itemCatalog.form.category.none")}</SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>{t("itemCatalog.form.label.description")}</Label>
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("itemCatalog.form.placeholder.description")} />
        </div>
      </div>
    );
  }

  const amountOf = (it: Item) => (kind === "menu" ? it.basePrice : it.cost);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{cfg.title}</h1>
          <p className="text-sm text-slate-500">{cfg.subtitle}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> {cfg.addLabel}
        </Button>
      </div>

      {isLoading ? null : (items ?? []).length === 0 ? (
        <GuidedEmptyState icon={cfg.icon} title={cfg.emptyTitle} description={cfg.emptyDesc} actionLabel={cfg.addLabel} onAction={openCreate} />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder={t("itemCatalog.search.placeholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{t("itemCatalog.table.col.name")}</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">{cfg.amountLabel}</th>
                  {kind === "menu" && <th className="px-4 py-3 text-left font-medium text-slate-600">{t("itemCatalog.table.col.category")}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} onClick={() => openEdit(it)} className="cursor-pointer border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{it.name}</td>
                    <td className="px-4 py-3 text-slate-600">{amountOf(it) ? fmt(amountOf(it)!) : "—"}</td>
                    {kind === "menu" && <td className="px-4 py-3 text-slate-500">{it.categoryName ?? "—"}</td>}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={kind === "menu" ? 3 : 2} className="px-4 py-8 text-center text-slate-400">
                      {t("itemCatalog.table.noMatches")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cfg.addLabel}</DialogTitle>
          </DialogHeader>
          {renderFields()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("itemCatalog.btn.cancel")}
            </Button>
            <Button disabled={!form.name.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("itemCatalog.btn.saving") : t("itemCatalog.btn.add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit (click a row) */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {cfg.editLabel}</DialogTitle>
          </DialogHeader>
          {renderFields()}
          {kind === "menu" && editing ? <RecipeEditor itemId={editing.id} itemName={editing.name} /> : null}
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
              {t("itemCatalog.btn.remove")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                {t("itemCatalog.btn.cancel")}
              </Button>
              <Button disabled={!form.name.trim() || update.isPending} onClick={() => update.mutate()}>
                {update.isPending ? t("itemCatalog.btn.saving") : t("itemCatalog.btn.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("itemCatalog.confirmDelete.title", { name: editing?.name ?? "" })}
        description={t("itemCatalog.confirmDelete.description")}
        confirmLabel={t("itemCatalog.confirmDelete.confirmLabel")}
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
