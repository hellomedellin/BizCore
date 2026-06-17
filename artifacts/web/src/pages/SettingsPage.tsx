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
import { Plus, Trash2, Copy, Eye, EyeOff, Pencil } from "lucide-react";

const ALL_MODULES = [
  { key: "inventory", label: "Inventory" },
  { key: "consumption_profiles", label: "Consumption Profiles" },
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
  { key: "employees", label: "Employees" },
  { key: "time_tracking", label: "Time Tracking" },
  { key: "scheduling", label: "Scheduling" },
  { key: "purchasing", label: "Purchasing" },
  { key: "invoice_ai", label: "Invoice AI" },
  { key: "reporting", label: "Reporting" },
  { key: "api_access", label: "API Access" },
];

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
  const qc = useQueryClient();
  const errText = (e: any) => e?.response?.data?.error ?? "Please try again.";

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["business"] }); setBizOpen(false); toast({ title: "Business saved", variant: "success" }); },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); setLocCreateOpen(false); toast({ title: "Location added", variant: "success" }); },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });
  const updateLoc = useMutation({
    mutationFn: () => api.patch(`/locations/${editingLoc!.id}`, locPayload()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); setEditingLoc(null); toast({ title: "Location saved", variant: "success" }); },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });
  const toggleLocActive = useMutation({
    mutationFn: (active: boolean) => api.patch(`/locations/${editingLoc!.id}`, { active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); setConfirmLoc(false); setEditingLoc(null); toast({ title: "Location updated", variant: "success" }); },
    onError: (e) => { setConfirmLoc(false); toast({ title: "Couldn't update", description: errText(e), variant: "destructive" }); },
  });

  function renderLocFields() {
    return (
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} placeholder="e.g. Main location" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={loc.type} onValueChange={(v) => setLoc({ ...loc, type: v })}>
              <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCATION_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={loc.timezone} onValueChange={(v) => setLoc({ ...loc, timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={loc.phone} onChange={(e) => setLoc({ ...loc, phone: e.target.value })} />
        </div>
      </div>
    );
  }

  // ── api keys (unchanged) ──────────────────────────────────────────────────
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

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Business */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Business</CardTitle>
          <Button size="sm" variant="outline" onClick={openBiz}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {[["Name", business?.name], ["Currency", business?.currencyCode], ["Timezone", business?.timezone], ["Phone", business?.phone], ["Email", business?.email], ["Address", business?.address]].map(([k, v]) => (
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
          <CardTitle>Locations</CardTitle>
          <Button size="sm" onClick={openLocCreate}><Plus className="mr-1 h-3.5 w-3.5" /> Add location</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(locations ?? []).map((l) => (
            <button key={l.id} onClick={() => openLocEdit(l)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 text-left hover:bg-slate-50">
              <div>
                <p className="font-medium text-sm">{l.name}</p>
                <p className="text-xs text-slate-500 capitalize">{l.type} · {l.timezone}</p>
              </div>
              <Badge variant={l.active ? "success" : "secondary"}>{l.active ? "Active" : "Inactive"}</Badge>
            </button>
          ))}
          {!(locations ?? []).length && <p className="text-sm text-slate-400">No locations yet.</p>}
        </CardContent>
      </Card>

      {/* Feature Modules */}
      <Card>
        <CardHeader><CardTitle>Feature Modules</CardTitle></CardHeader>
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
          <CardTitle>API Keys</CardTitle>
          <Dialog open={newKeyOpen} onOpenChange={setNewKeyOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-3 w-3" /> New Key</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                {createdKey ? (
                  <div className="space-y-3">
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">Copy this key now — it will not be shown again.</p>
                    <div className="flex gap-2">
                      <Input value={showKey ? createdKey : "•".repeat(24)} readOnly className="font-mono text-xs" />
                      <Button size="icon" variant="outline" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                      <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(createdKey)}><Copy className="h-4 w-4" /></Button>
                    </div>
                    <Button className="w-full" onClick={() => { setNewKeyOpen(false); setCreatedKey(""); setShowKey(false); }}>Done</Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Key Name *</Label>
                      <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. POS System" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setNewKeyOpen(false)}>Cancel</Button>
                      <Button disabled={!newKeyName || createKey.isPending} onClick={() => createKey.mutate()}>Create</Button>
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-2">
          {!(apiKeys ?? []).length && <p className="text-sm text-slate-400">No API keys.</p>}
          {(apiKeys ?? []).map((key: any) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
              <div>
                <p className="font-medium text-sm">{key.name}</p>
                <p className="font-mono text-xs text-slate-400">{key.keyPrefix}…</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={key.active ? "success" : "secondary"}>{key.active ? "Active" : "Revoked"}</Badge>
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
          <DialogHeader><DialogTitle>Edit business</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={biz.currencyCode} onValueChange={(v) => setBiz({ ...biz, currencyCode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Timezone</Label>
                <Select value={biz.timezone} onValueChange={(v) => setBiz({ ...biz, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBizOpen(false)}>Cancel</Button>
              <Button disabled={!biz.name.trim() || saveBiz.isPending} onClick={() => saveBiz.mutate()}>{saveBiz.isPending ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location create */}
      <Dialog open={locCreateOpen} onOpenChange={setLocCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add location</DialogTitle></DialogHeader>
          {renderLocFields()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLocCreateOpen(false)}>Cancel</Button>
            <Button disabled={!loc.name.trim() || createLoc.isPending} onClick={() => createLoc.mutate()}>{createLoc.isPending ? "Saving…" : "Add"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location edit */}
      <Dialog open={!!editingLoc} onOpenChange={(o) => { if (!o) setEditingLoc(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit location</DialogTitle></DialogHeader>
          {renderLocFields()}
          <div className="flex items-center justify-between pt-1">
            {editingLoc?.active ? (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmLoc(true)}>Deactivate</Button>
            ) : (
              <Button variant="ghost" className="text-green-700 hover:bg-green-50" onClick={() => toggleLocActive.mutate(true)}>Reactivate</Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingLoc(null)}>Cancel</Button>
              <Button disabled={!loc.name.trim() || updateLoc.isPending} onClick={() => updateLoc.mutate()}>{updateLoc.isPending ? "Saving…" : "Save"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmLoc}
        onOpenChange={setConfirmLoc}
        title={`Deactivate ${editingLoc?.name ?? "this location"}?`}
        description="It won't appear as an option for new orders, stock, or staff. You can reactivate it later."
        confirmLabel="Deactivate"
        destructive
        loading={toggleLocActive.isPending}
        onConfirm={() => toggleLocActive.mutate(false)}
      />
    </div>
  );
}
