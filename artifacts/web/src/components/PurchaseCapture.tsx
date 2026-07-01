import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hint } from "@/components/ui/hint";
import { toast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { useT } from "@/lib/i18n";
import { Camera, Plus, Trash2, PencilLine } from "lucide-react";

interface Supplier { id: string; name: string }
interface Unit { id: string; abbreviation: string; unitType: string }
interface Ingredient { itemId: string; itemName: string; variantId: string }
interface Line { description: string; variantId: string; quantity: string; unitId: string; unitCost: string }
interface CapturedPO { id: string; supplierId: string | null; taxId: string | null; expenseCategory: string | null; notes: string | null; receiptMissing: boolean; lines: { description: string; quantity: string; unitCost: string; unitId: string | null }[] }

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      const meta = result.slice(0, comma);
      const data = result.slice(comma + 1);
      const mediaType = meta.match(/data:(.*);base64/)?.[1] ?? file.type;
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMPTY_FORM = { supplierId: "", taxId: "", expenseCategory: "", notes: "", receiptMissing: false };
const EMPTY_LINE: Line = { description: "", variantId: "", quantity: "", unitId: "", unitCost: "" };

// Scan a receipt (Claude vision) or enter manually → review AI-filled fields → approve.
// Reused by Purchasing and the /me portal. Guided and plain-language on purpose.
export function PurchaseCapture({ locationId, onDone }: { locationId: string | null; onDone?: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const { fmt } = useCurrency();
  const fileRef = useRef<HTMLInputElement>(null);

  const [reviewId, setReviewId] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [lines, setLines] = useState<Line[]>([]);
  const [scanning, setScanning] = useState(false);

  const { data: captureStatus } = useQuery({ queryKey: ["capture-status"], queryFn: () => api.get("/purchases/capture/status").then((r) => r.data as { available: boolean }) });
  const { data: pending } = useQuery({ queryKey: ["purchases-pending"], queryFn: () => api.get("/purchases/pending").then((r) => r.data as Array<{ id: string; createdAt: string; source: string }>) });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers").then((r) => r.data as Supplier[]) });
  const { data: units } = useQuery({ queryKey: ["units"], queryFn: () => api.get("/units").then((r) => (r.data as Unit[]).filter((u) => u.unitType !== "time")) });
  const { data: ingredients } = useQuery({ queryKey: ["ingredients-variants"], queryFn: () => api.get("/items/ingredients").then((r) => r.data as Ingredient[]) });

  const errText = (e: any) => e?.response?.data?.error ?? t("common.error");
  const needLocation = () => { toast({ title: t("capture.pickLocation"), variant: "destructive" }); };

  function openReview(po: CapturedPO) {
    setReviewId(po.id);
    setForm({
      supplierId: po.supplierId ?? "",
      taxId: po.taxId ?? "",
      expenseCategory: po.expenseCategory ?? "",
      notes: po.notes ?? "",
      receiptMissing: po.receiptMissing ?? false,
    });
    setLines(
      (po.lines ?? []).length
        ? po.lines.map((l) => ({ description: l.description, variantId: "", quantity: String(parseFloat(l.quantity)), unitId: l.unitId ?? "", unitCost: String(parseFloat(l.unitCost)) }))
        : [{ ...EMPTY_LINE }],
    );
  }

  async function openExisting(poId: string) {
    try {
      const r = await api.get(`/purchase-orders/${poId}`);
      setImgUrl(null);
      openReview(r.data);
    } catch (e) {
      toast({ title: t("common.error"), description: errText(e), variant: "destructive" });
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!locationId) return needLocation();
    setScanning(true);
    try {
      const { data, mediaType } = await fileToBase64(file);
      setImgUrl(URL.createObjectURL(file));
      const r = await api.post("/purchases/capture", { locationId, imageBase64: data, mediaType });
      openReview(r.data);
    } catch (e) {
      toast({ title: t("capture.couldntRead"), description: errText(e), variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }

  const startManual = useMutation({
    mutationFn: () => api.post("/purchases/draft", { locationId }),
    onSuccess: (r) => { setImgUrl(null); openReview(r.data); },
    onError: (e) => toast({ title: t("capture.couldntStart"), description: errText(e), variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: () =>
      api.post(`/purchases/${reviewId}/approve`, {
        supplierId: form.supplierId || null,
        taxId: form.taxId || null,
        expenseCategory: form.expenseCategory || null,
        receiptMissing: form.receiptMissing,
        notes: form.notes || null,
        lines: lines
          .filter((l) => l.description.trim())
          .map((l) => ({ variantId: l.variantId || null, description: l.description.trim(), quantity: l.quantity || "0", unitId: l.unitId || null, unitCost: l.unitCost || "0" })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchases-pending"] });
      setReviewId(null);
      setImgUrl(null);
      toast({ title: t("capture.recorded"), variant: "success" });
      onDone?.();
    },
    onError: (e) => toast({ title: t("capture.couldntApprove"), description: errText(e), variant: "destructive" }),
  });

  const total = lines.reduce((s, l) => s + (parseFloat(l.quantity || "0") * parseFloat(l.unitCost || "0") || 0), 0);
  const canApprove = lines.some((l) => l.description.trim()) && !approve.isPending;
  const setLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, x) => (x === i ? { ...l, ...patch } : l)));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {captureStatus?.available !== false && (
          <Button onClick={() => (locationId ? fileRef.current?.click() : needLocation())} disabled={scanning}>
            <Camera className="mr-1.5 h-4 w-4" />
            {scanning ? t("capture.scanning") : t("capture.scanReceipt")}
          </Button>
        )}
        <Button variant="outline" disabled={startManual.isPending} onClick={() => (locationId ? startManual.mutate() : needLocation())}>
          <PencilLine className="mr-1.5 h-4 w-4" />
          {t("capture.enterManually")}
        </Button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={onFile} />
      </div>

      {/* Pending-review queue */}
      {(pending ?? []).length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">{t("capture.pendingTitle", { count: String(pending!.length) })}</p>
          <div className="divide-y divide-slate-100 rounded-lg border border-amber-100 bg-amber-50/40">
            {pending!.map((p) => (
              <button key={p.id} onClick={() => openExisting(p.id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-amber-50">
                <span className="text-slate-700">{p.source === "invoice_ai" ? t("capture.fromScan") : t("capture.fromManual")} · {new Date(p.createdAt).toLocaleDateString()}</span>
                <span className="text-xs font-medium text-amber-700">{t("capture.reviewNow")} →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={!!reviewId} onOpenChange={(o) => { if (!o) { setReviewId(null); setImgUrl(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t("capture.review.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <Hint>{t("capture.review.hint")}</Hint>

            {imgUrl && (
              <img src={imgUrl} alt="receipt" className="max-h-48 w-auto rounded-lg border border-slate-200 object-contain" />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("capture.review.supplier")}</Label>
                <Select value={form.supplierId || "none"} onValueChange={(v) => setForm({ ...form, supplierId: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder={t("capture.review.supplierNone")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("capture.review.supplierNone")}</SelectItem>
                    {(suppliers ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("capture.review.taxId")} <span className="text-slate-400 text-xs">({t("common.optional")})</span></Label>
                <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} placeholder={t("capture.review.taxIdPlaceholder")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("capture.review.expenseCategory")} <span className="text-slate-400 text-xs">({t("common.optional")})</span></Label>
              <Input value={form.expenseCategory} onChange={(e) => setForm({ ...form, expenseCategory: e.target.value })} placeholder={t("capture.review.expensePlaceholder")} />
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <Label>{t("capture.review.items")}</Label>
              {lines.map((l, i) => (
                <div key={i} className="space-y-1.5 rounded-lg border border-slate-200 p-2">
                  <div className="flex items-center gap-2">
                    <Input className="flex-1" value={l.description} placeholder={t("capture.review.itemName")} onChange={(e) => setLine(i, { description: e.target.value })} />
                    <button onClick={() => setLines((prev) => prev.filter((_, x) => x !== i))} className="text-slate-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input className="w-16" inputMode="decimal" placeholder={t("capture.review.qty")} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                    <Select value={l.unitId || "none"} onValueChange={(v) => setLine(i, { unitId: v === "none" ? "" : v })}>
                      <SelectTrigger className="h-9 w-20"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">—</SelectItem>{(units ?? []).map((u) => <SelectItem key={u.id} value={u.id}>{u.abbreviation}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="w-24" inputMode="decimal" placeholder={t("capture.review.unitCost")} value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} />
                    <span className="ml-auto text-sm tabular-nums text-slate-500">{fmt(parseFloat(l.quantity || "0") * parseFloat(l.unitCost || "0") || 0)}</span>
                  </div>
                  <Select value={l.variantId || "none"} onValueChange={(v) => setLine(i, { variantId: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("capture.review.linkIngredient")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("capture.review.noLink")}</SelectItem>
                      {(ingredients ?? []).map((ing) => <SelectItem key={ing.variantId} value={ing.variantId}>{ing.itemName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> {t("capture.review.addItem")}
              </Button>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.receiptMissing} onChange={(e) => setForm({ ...form, receiptMissing: e.target.checked })} />
              {t("capture.review.receiptMissing")}
            </label>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm text-slate-500">{t("capture.review.total")}</span>
              <span className="text-lg font-bold tabular-nums">{fmt(total)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setReviewId(null); setImgUrl(null); }}>{t("common.cancel")}</Button>
              <Button disabled={!canApprove} onClick={() => approve.mutate()}>
                {approve.isPending ? t("common.saving") : t("capture.review.approve")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
