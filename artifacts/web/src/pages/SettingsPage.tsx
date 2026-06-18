import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { Hint } from "@/components/ui/hint";
import { Plus, Trash2, Copy, Eye, EyeOff, Pencil, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const CURRENCIES = ["COP", "USD", "EUR", "MXN", "BRL", "ARS", "CLP", "PEN", "CRC", "GBP"];
const TIMEZONES = [
  "America/Bogota", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Mexico_City", "America/Sao_Paulo", "Europe/Madrid", "Europe/London",
];
const LOCATION_TYPES = ["restaurant", "retail", "service", "warehouse", "office"];

interface Location {
  id: string;
  name: string;
  type: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  active: boolean;
}

const EMPTY_LOC = { name: "", type: "restaurant", address: "", phone: "", timezone: "America/Bogota" };

export function SettingsPage() {
  const t = useT();
  const qc = useQueryClient();
  const errText = (e: any) => e?.response?.data?.error ?? t("common.error");

  const ALL_MODULES = [
    { key: "inventory", label: t("settings.modules.inventory") },
    { key: "consumption_profiles", label: t("settings.modules.consumptionProfiles") },
    { key: "orders", label: t("settings.modules.orders") },
    { key: "customers", label: t("settings.modules.customers") },
    { key: "employees", label: t("settings.modules.employees") },
    { key: "time_tracking", label: t("settings.modules.timeTracking") },
    { key: "scheduling", label: t("settings.modules.scheduling") },
    { key: "purchasing", label: t("settings.modules.purchasing") },
    { key: "invoice_ai", label: t("settings.modules.invoiceAi") },
    { key: "reporting", label: t("settings.modules.reporting") },
    { key: "api_access", label: t("settings.modules.apiAccess") },
  ];

  // ── queries ───────────────────────────────────────────────────────────────
  const { data: business } = useQuery({ queryKey: ["business"], queryFn: () => api.get("/businesses/me").then((r) => r.data) });
  const { data: locations } = useQuery({ queryKey: ["locations"], queryFn: () => api.get("/locations").then((r) => r.data as Location[]) });
  const { data: modules } = useQuery({ queryKey: ["modules"], queryFn: () => api.get("/modules").then((r) => r.data as Array<{ module: string; enabled: boolean }>) });
  const { data: apiKeys } = useQuery({ queryKey: ["api-keys"], queryFn: () => api.get("/api-keys").then((r) => r.data) });
  const enabledSet = new Set((modules ?? []).filter((m) => m.enabled).map((m) => m.module));

  // ── business edit ─────────────────────────────────────────────────────────
  const [bizOpen, setBizOpen] = useState(false);
  const [biz, setBiz] = useState({ name: "", currencyCode: "COP", timezone: "America/Bogota", phone: "", email: "", address: "" });
  function openBiz() {
    setBiz({
      name: business?.name ?? "",
      currencyCode: business?.currencyCode ?? "COP",
      timezone: business?.timezone ?? "America/Bogota",
      phone: business?.phone ?? "",
      email: business?.email ?? "",
      address: business?.address ?? "",
    });
    setBizOpen(true);
  }
  const saveBiz = useMutation({
    mutationFn: () => api.patch("/businesses/me", { ...biz, phone: biz.phone || null, email: biz.email || null, address: biz.address || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["business"] }); setBizOpen(false); toast({ title: t("settings.toast.businessSaved"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });

  // ── locations ───────────────────────────────────────────────────────────────
  const [locCreateOpen, setLocCreateOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);
  const [confirmLoc, setConfirmLoc] = useState(false);
  const [loc, setLoc] = useState(EMPTY_LOC);
  function openLocCreate() { setLoc(EMPTY_LOC); setLocCreateOpen(true); }
  function openLocEdit(l: Location) {
    setLoc({ name: l.name, type: l.type, address: l.address ?? "", phone: l.phone ?? "", timezone: l.timezone });
    setEditingLoc(l);
  }
  const locPayload = () => ({ ...loc, address: loc.address || null, phone: loc.phone || null });
  const createLoc = useMutation({
    mutationFn: () => api.post("/locations", locPayload()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); setLocCreateOpen(false); toast({ title: t("settings.toast.locationAdded"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  const updateLoc = useMutation({
    mutationFn: () => api.patch(`/locations/${editingLoc!.id}`, locPayload()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); setEditingLoc(null); toast({ title: t("settings.toast.locationSaved"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  const toggleLocActive = useMutation({
    mutationFn: (active: boolean) => api.patch(`/locations/${editingLoc!.id}`, { active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); setConfirmLoc(false); setEditingLoc(null); toast({ title: t("settings.toast.locationUpdated"), variant: "success" }); },
    onError: (e) => { setConfirmLoc(false); toast({ title: t("settings.toast.couldntUpdate"), description: errText(e), variant: "destructive" }); },
  });

  function renderLocFields() {
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>{t("settings.locFields.label.name")}</Label>
          <Input value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} placeholder={t("settings.locFields.placeholder.name")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("settings.locFields.label.type")}</Label>
            <Select value={loc.type} onValueChange={(v) => setLoc({ ...loc, type: v })}>
              <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.locFields.label.timezone")}</Label>
            <Select value={loc.timezone} onValueChange={(v) => setLoc({ ...loc, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.locFields.label.address")}</Label>
          <Input value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t("settings.locFields.label.phone")}</Label>
          <Input value={loc.phone} onChange={(e) => setLoc({ ...loc, phone: e.target.value })} />
        </div>
      </div>
    );
  }

  // ── api keys ──────────────────────────────────────────────────────────────
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyOpen, setNewKeyOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const toggleModule = useMutation({
    mutationFn: ({ module, enabled }: { module: string; enabled: boolean }) => api.put("/modules/bulk", { modules: [{ module, enabled }] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });
  const createKey = useMutation({
    mutationFn: () => api.post("/api-keys", { name: newKeyName, scopes: ["orders:write", "orders:read"] }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["api-keys"] }); setCreatedKey(res.data.key); setNewKeyName(""); },
  });
  const revokeKey = useMutation({
    mutationFn: (id: string) => api.patch(`/api-keys/${id}`, { active: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  // ── POS integration ───────────────────────────────────────────────────────
  const { data: posConn } = useQuery({ queryKey: ["pos-connection"], queryFn: () => api.get("/pos-connection").then((r) => r.data).catch(() => null) });
  const [posForm, setPosForm] = useState({ name: "", apiUrl: "", apiKey: "" });
  const [posKeyVisible, setPosKeyVisible] = useState(false);
  const [posEditing, setPosEditing] = useState(false);
  function openPosEdit() {
    setPosForm({ name: posConn?.name ?? "", apiUrl: posConn?.apiUrl ?? "", apiKey: "" });
    setPosEditing(true);
  }
  const savePos = useMutation({
    mutationFn: () => api.put("/pos-connection", { name: posForm.name, apiUrl: posForm.apiUrl, apiKey: posForm.apiKey || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos-connection"] }); setPosEditing(false); toast({ title: t("settings.toast.posSaved"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  const syncPos = useMutation({
    mutationFn: () => api.post("/payments/pos-sync"),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["pos-connection"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      const { imported, skipped } = res.data;
      toast({ title: t("settings.toast.syncComplete", { imported, skipped }), variant: "success" });
    },
    onError: (e) => toast({ title: t("settings.toast.syncFailed"), description: errText(e), variant: "destructive" }),
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">{t("settings.title")}</h1>

      {/* Business */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("settings.business.cardTitle")}</CardTitle>
          <Button size="sm" variant="outline" onClick={openBiz}><Pencil className="mr-1 h-3.5 w-3.5" /> {t("settings.business.btn.edit")}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            [t("settings.business.field.name"), business?.name],
            [t("settings.business.field.currency"), business?.currencyCode],
            [t("settings.business.field.timezone"), business?.timezone],
            [t("settings.business.field.phone"), business?.phone],
            [t("settings.business.field.email"), business?.email],
            [t("settings.business.field.address"), business?.address],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-4 text-sm">
              <span className="font-medium w-32 text-slate-600">{k}</span>
              <span className="text-slate-900">{v || "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("settings.locations.cardTitle")}</CardTitle>
          <Button size="sm" onClick={openLocCreate}><Plus className="mr-1 h-3.5 w-3.5" /> {t("settings.locations.btn.add")}</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(locations ?? []).map((l) => (
            <button key={l.id} onClick={() => openLocEdit(l)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50">
              <div>
                <p className="font-medium text-sm">{l.name}</p>
                <p className="text-xs text-slate-500 capitalize">{l.type} · {l.timezone}</p>
              </div>
              <Badge variant={l.active ? "success" : "secondary"}>{l.active ? t("settings.locations.badge.active") : t("settings.locations.badge.inactive")}</Badge>
            </button>
          ))}
          {!(locations ?? []).length && <p className="text-sm text-slate-400">{t("settings.locations.empty")}</p>}
        </CardContent>
      </Card>

      {/* Feature Modules */}
      <Card>
        <CardHeader><CardTitle>{t("settings.modules.cardTitle")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {ALL_MODULES.map((m) => (
              <div key={m.key} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <span className="text-sm font-medium">{m.label}</span>
                <button
                  onClick={() => toggleModule.mutate({ module: m.key, enabled: !enabledSet.has(m.key) })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabledSet.has(m.key) ? "bg-slate-900" : "bg-slate-200"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabledSet.has(m.key) ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("settings.apiKeys.cardTitle")}</CardTitle>
          <Dialog open={newKeyOpen} onOpenChange={setNewKeyOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-3 w-3" /> {t("settings.apiKeys.btn.newKey")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("settings.apiKeys.createDialog.title")}</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                {createdKey ? (
                  <div className="space-y-3">
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">{t("settings.apiKeys.createDialog.warning")}</p>
                    <div className="flex gap-2">
                      <Input value={showKey ? createdKey : "•".repeat(24)} readOnly className="font-mono text-xs" />
                      <Button size="icon" variant="outline" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                      <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(createdKey)}><Copy className="h-4 w-4" /></Button>
                    </div>
                    <Button className="w-full" onClick={() => { setNewKeyOpen(false); setCreatedKey(""); setShowKey(false); }}>{t("settings.apiKeys.createDialog.btn.done")}</Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{t("settings.apiKeys.createDialog.label.keyName")}</Label>
                      <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder={t("settings.apiKeys.createDialog.placeholder.keyName")} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setNewKeyOpen(false)}>{t("settings.apiKeys.createDialog.btn.cancel")}</Button>
                      <Button disabled={!newKeyName || createKey.isPending} onClick={() => createKey.mutate()}>{t("settings.apiKeys.createDialog.btn.create")}</Button>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {!(apiKeys ?? []).length && <p className="text-sm text-slate-400">{t("settings.apiKeys.empty")}</p>}
          {(apiKeys ?? []).map((key: any) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
              <div>
                <p className="font-medium text-sm">{key.name}</p>
                <p className="font-mono text-xs text-slate-400">{key.keyPrefix}…</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={key.active ? "success" : "secondary"}>{key.active ? t("settings.apiKeys.badge.active") : t("settings.apiKeys.badge.revoked")}</Badge>
                {key.active && (
                  <button onClick={() => revokeKey.mutate(key.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Business edit dialog */}
      <Dialog open={bizOpen} onOpenChange={setBizOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("settings.bizDialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("settings.bizDialog.label.name")}</Label>
              <Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("settings.bizDialog.label.currency")}</Label>
                <Select value={biz.currencyCode} onValueChange={(v) => setBiz({ ...biz, currencyCode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.bizDialog.label.timezone")}</Label>
                <Select value={biz.timezone} onValueChange={(v) => setBiz({ ...biz, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>{t("settings.bizDialog.label.phone")}</Label><Input value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("settings.bizDialog.label.email")}</Label><Input type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>{t("settings.bizDialog.label.address")}</Label><Input value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBizOpen(false)}>{t("settings.bizDialog.btn.cancel")}</Button>
              <Button disabled={!biz.name.trim() || saveBiz.isPending} onClick={() => saveBiz.mutate()}>{saveBiz.isPending ? t("settings.bizDialog.btn.saving") : t("settings.bizDialog.btn.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location create */}
      <Dialog open={locCreateOpen} onOpenChange={setLocCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("settings.locCreateDialog.title")}</DialogTitle></DialogHeader>
          {renderLocFields()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLocCreateOpen(false)}>{t("settings.locCreateDialog.btn.cancel")}</Button>
            <Button disabled={!loc.name.trim() || createLoc.isPending} onClick={() => createLoc.mutate()}>{createLoc.isPending ? t("settings.locCreateDialog.btn.saving") : t("settings.locCreateDialog.btn.add")}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location edit */}
      <Dialog open={!!editingLoc} onOpenChange={(o) => { if (!o) setEditingLoc(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("settings.locEditDialog.title")}</DialogTitle></DialogHeader>
          {renderLocFields()}
          <div className="flex items-center justify-between pt-1">
            {editingLoc?.active ? (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmLoc(true)}>{t("settings.locEditDialog.btn.deactivate")}</Button>
            ) : (
              <Button variant="ghost" className="text-green-700 hover:bg-green-50" onClick={() => toggleLocActive.mutate(true)}>{t("settings.locEditDialog.btn.reactivate")}</Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingLoc(null)}>{t("settings.locEditDialog.btn.cancel")}</Button>
              <Button disabled={!loc.name.trim() || updateLoc.isPending} onClick={() => updateLoc.mutate()}>{updateLoc.isPending ? t("settings.locEditDialog.btn.saving") : t("settings.locEditDialog.btn.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* POS Integration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("settings.pos.cardTitle")}</CardTitle>
          {posConn && !posEditing && (
            <Button size="sm" variant="outline" onClick={openPosEdit}><Pencil className="mr-1 h-3.5 w-3.5" /> {t("settings.pos.btn.edit")}</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Hint>{t("settings.pos.hint")}</Hint>

          {!posConn && !posEditing ? (
            <Button variant="outline" onClick={openPosEdit}><Plus className="mr-1 h-4 w-4" /> {t("settings.pos.btn.connect")}</Button>
          ) : posEditing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("settings.pos.form.label.connectionName")}</Label>
                <Input value={posForm.name} onChange={(e) => setPosForm({ ...posForm, name: e.target.value })} placeholder={t("settings.pos.form.placeholder.connectionName")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.pos.form.label.apiUrl")}</Label>
                <Input value={posForm.apiUrl} onChange={(e) => setPosForm({ ...posForm, apiUrl: e.target.value })} placeholder={t("settings.pos.form.placeholder.apiUrl")} />
              </div>
              <div className="space-y-1.5">
                <Label>{posConn ? t("settings.pos.form.label.apiKeyCurrent") : t("settings.pos.form.label.apiKey")}</Label>
                <div className="flex gap-2">
                  <Input
                    type={posKeyVisible ? "text" : "password"}
                    value={posForm.apiKey}
                    onChange={(e) => setPosForm({ ...posForm, apiKey: e.target.value })}
                    placeholder={posConn ? "•••••••••••••••" : t("settings.pos.form.placeholder.apiKeyNew")}
                  />
                  <Button size="icon" variant="outline" onClick={() => setPosKeyVisible(!posKeyVisible)}>
                    {posKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPosEditing(false)}>{t("settings.pos.form.btn.cancel")}</Button>
                <Button disabled={!posForm.name.trim() || !posForm.apiUrl.trim() || savePos.isPending} onClick={() => savePos.mutate()}>
                  {savePos.isPending ? t("settings.pos.form.btn.saving") : t("settings.pos.form.btn.save")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
                {[
                  [t("settings.pos.detail.field.name"), posConn.name],
                  [t("settings.pos.detail.field.apiUrl"), posConn.apiUrl],
                  [t("settings.pos.detail.field.lastSync"), posConn.lastSyncAt ? formatDateTime(posConn.lastSyncAt) : t("settings.pos.detail.lastSync.never")],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center gap-4 px-3 py-2 text-sm">
                    <span className="font-medium w-24 text-slate-600">{k}</span>
                    <span className="text-slate-900 truncate">{v}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" disabled={syncPos.isPending} onClick={() => syncPos.mutate()}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${syncPos.isPending ? "animate-spin" : ""}`} />
                {syncPos.isPending ? t("settings.pos.btn.syncing") : t("settings.pos.btn.syncNow")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmLoc}
        onOpenChange={setConfirmLoc}
        title={t("settings.confirmDeactivate.title", { name: editingLoc?.name ?? "" })}
        description={t("settings.confirmDeactivate.description")}
        confirmLabel={t("settings.confirmDeactivate.confirmLabel")}
        destructive
        loading={toggleLocActive.isPending}
        onConfirm={() => toggleLocActive.mutate(false)}
      />
    </div>
  );
}
