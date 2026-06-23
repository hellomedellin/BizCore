import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GuidedEmptyState } from "@/components/GuidedEmptyState";
import { toast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { Plus, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode, Dispatch, SetStateAction } from "react";

export interface DirectoryColumn<T> {
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
}

interface Props<T extends { id: string; name: string }, F extends Record<string, string>> {
  queryKey: string[];
  endpoint: string;
  emptyForm: F;
  toPayload: (form: F) => Record<string, unknown>;
  toFormValues: (item: T) => F;

  title: string;
  subtitle: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  addLabel: string;
  entitySingular: string;
  removeDescription: string;
  toastAdded: string;

  columns: DirectoryColumn<T>[];
  renderFields: (form: F, setForm: Dispatch<SetStateAction<F>>) => ReactNode;
  searchPlaceholder?: string;
  // Optional extra panel shown in the edit dialog for an existing record
  // (e.g. a customer's order history). Receives the record id.
  renderDetail?: (id: string) => ReactNode;
}

export function DirectoryCatalog<T extends { id: string; name: string }, F extends Record<string, string>>({
  queryKey,
  endpoint,
  emptyForm,
  toPayload,
  toFormValues,
  title,
  subtitle,
  icon,
  emptyTitle,
  emptyDescription,
  addLabel,
  entitySingular,
  removeDescription,
  toastAdded,
  columns,
  renderFields,
  searchPlaceholder,
  renderDetail,
}: Props<T, F>) {
  const t = useT();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<F>(emptyForm);

  const { data: items, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.get(endpoint).then((r) => r.data as T[]),
  });

  const filtered = (items ?? []).filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const errText = (e: unknown) => (e as any)?.response?.data?.error ?? t("common.error");

  const create = useMutation({
    mutationFn: () => api.post(endpoint, toPayload(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setCreateOpen(false);
      setForm(emptyForm);
      toast({ title: toastAdded, variant: "success" });
    },
    onError: (e) => toast({ title: t("directoryCatalog.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: () => api.patch(`${endpoint}/${editing!.id}`, toPayload(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setEditing(null);
      toast({ title: t("directoryCatalog.toast.saved"), variant: "success" });
    },
    onError: (e) => toast({ title: t("directoryCatalog.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => api.patch(`${endpoint}/${editing!.id}`, { active: false }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setConfirmDelete(false);
      setEditing(null);
      toast({ title: t("directoryCatalog.toast.removed"), variant: "success" });
    },
    onError: (e) => {
      setConfirmDelete(false);
      toast({ title: t("directoryCatalog.toast.couldntRemove"), description: errText(e), variant: "destructive" });
    },
  });

  function openCreate() {
    setForm(emptyForm);
    setCreateOpen(true);
  }
  function openEdit(item: T) {
    setForm(toFormValues(item));
    setEditing(item);
  }

  const colSpan = columns.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> {addLabel}
        </Button>
      </div>

      {isLoading ? null : (items ?? []).length === 0 ? (
        <GuidedEmptyState
          icon={icon}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={addLabel}
          onAction={openCreate}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder={searchPlaceholder ?? t("directoryCatalog.search.placeholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.header}
                      className={`px-4 py-3 font-medium text-slate-600 ${col.align === "right" ? "text-right" : "text-left"}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => openEdit(item)}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.header}
                        className={`px-4 py-3 ${col.className ?? "text-slate-500"} ${col.align === "right" ? "text-right" : ""}`}
                      >
                        {col.render(item)}
                      </td>
                    ))}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-400">
                      {t("directoryCatalog.table.noMatches")}
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
            <DialogTitle>{addLabel}</DialogTitle>
          </DialogHeader>
          {renderFields(form, setForm)}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("directoryCatalog.btn.cancel")}
            </Button>
            <Button disabled={!form.name?.trim() || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("directoryCatalog.btn.saving") : t("directoryCatalog.btn.add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit (click a row) */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {entitySingular}</DialogTitle>
          </DialogHeader>
          {renderFields(form, setForm)}
          {editing && renderDetail ? renderDetail(editing.id) : null}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              {t("directoryCatalog.btn.remove")}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                {t("directoryCatalog.btn.cancel")}
              </Button>
              <Button disabled={!form.name?.trim() || update.isPending} onClick={() => update.mutate()}>
                {update.isPending ? t("directoryCatalog.btn.saving") : t("directoryCatalog.btn.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("directoryCatalog.confirmDelete.title", { name: editing?.name ?? "" })}
        description={removeDescription}
        confirmLabel={t("directoryCatalog.confirmDelete.confirmLabel")}
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
