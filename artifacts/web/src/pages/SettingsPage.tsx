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
import { Plus, Trash2, Copy, Eye, EyeOff, Pencil, RefreshCw, Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

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

  // ── team management ──────────────────────────────────────────────────────
  interface AppUser { id: string; username: string; displayName: string | null; role: string; active: boolean; createdAt: string }
  const { data: appUsers } = useQuery({ queryKey: ["app-users"], queryFn: () => api.get("/app-users").then((r) => r.data as AppUser[]) });
  const { user: currentUser } = useAuth();
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [newUser, setNewUser] = useState({ username: "", displayName: "", role: "staff", password: "" });
  const [editUser, setEditUser] = useState({ displayName: "", role: "", password: "" });
  const ROLES_FOR_SELECT = (callerRole: string) =>
    callerRole === "owner"
      ? ["owner", "admin", "manager", "accountant", "staff"]
      : ["admin", "manager", "accountant", "staff"];
  function roleLabel(role: string) {
    const map: Record<string, string> = {
      owner: t("settings.team.role.owner"),
      admin: t("settings.team.role.admin"),
      manager: t("settings.team.role.manager"),
      accountant: t("settings.team.role.accountant"),
      staff: t("settings.team.role.staff"),
    };
    return map[role] ?? role;
  }
  const createUser = useMutation({
    mutationFn: () => api.post("/app-users", { username: newUser.username.trim(), displayName: newUser.displayName.trim() || null, role: newUser.role, password: newUser.password }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app-users"] }); setAddUserOpen(false); setNewUser({ username: "", displayName: "", role: "staff", password: "" }); toast({ title: t("settings.team.toast.added"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  const updateUser = useMutation({
    mutationFn: (extra?: Record<string, any>) => api.patch(`/app-users/${editingUser!.id}`, { displayName: editUser.displayName || null, role: editUser.role, ...(editUser.password ? { password: editUser.password } : {}), ...extra }),
    onSuccess: (_, extra) => {
      qc.invalidateQueries({ queryKey: ["app-users"] });
      const title = extra?.active === false ? t("settings.team.toast.deactivated") : extra?.active === true ? t("settings.team.toast.reactivated") : t("settings.team.toast.saved");
      setEditingUser(null);
      toast({ title, variant: "success" });
    },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  function openEditUser(u: AppUser) {
    setEditUser({ displayName: u.displayName ?? "", role: u.role, password: "" });
    setEditingUser(u);
  }
  const isOwner = currentUser?.role === "owner";

  // ── categories ────────────────────────────────────────────────────────────
  interface Category { id: string; name: string; active: boolean; sortOrder: string | null }
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => api.get("/categories").then((r) => r.data as Category[]) });
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: string; name: string } | null>(null);
  const [confirmCat, setConfirmCat] = useState<Category | null>(null);
  const createCat = useMutation({
    mutationFn: () => api.post("/categories", { name: newCatName.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setNewCatName(""); toast({ title: t("settings.categories.toast.added"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  const renameCat = useMutation({
    mutationFn: () => api.patch(`/categories/${editingCat!.id}`, { name: editingCat!.name.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setEditingCat(null); toast({ title: t("settings.categories.toast.saved"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  const deleteCat = useMutation({
    mutationFn: (id: string) => api.patch(`/categories/${id}`, { active: false }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setConfirmCat(null); toast({ title: t("settings.categories.toast.removed"), variant: "success" }); },
    onError: (e) => { setConfirmCat(null); toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }); },
  });

  // ── Siigo integration ─────────────────────────────────────────────────────
  const { data: siigoConn } = useQuery({ queryKey: ["siigo-connection"], queryFn: () => api.get("/siigo-connection").then((r) => r.data).catch(() => null) });
  const [siigoForm, setSiigoForm] = useState({ username: "", accessKey: "" });
  const [siigoKeyVisible, setSiigoKeyVisible] = useState(false);
  const [siigoEditing, setSiigoEditing] = useState(false);
  const [confirmSiigo, setConfirmSiigo] = useState(false);
  function openSiigoEdit() {
    setSiigoForm({ username: siigoConn?.username ?? "", accessKey: "" });
    setSiigoEditing(true);
  }
  const saveSiigo = useMutation({
    mutationFn: () => api.put("/siigo-connection", { username: siigoForm.username, accessKey: siigoForm.accessKey }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["siigo-connection"] }); setSiigoEditing(false); toast({ title: t("settings.siigo.toast.saved"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  const deleteSiigo = useMutation({
    mutationFn: () => api.delete("/siigo-connection"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["siigo-connection"] }); toast({ title: t("settings.siigo.toast.disconnected"), variant: "success" }); },
    onError: (e) => toast({ title: t("settings.toast.couldntSave"), description: errText(e), variant: "destructive" }),
  });
  const syncSiigo = useMutation({
    mutationFn: () => api.post("/siigo-sync"),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["siigo-connection"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      const { imported, skipped, errors } = res.data;
      toast({
        title: t("settings.siigo.toast.syncComplete", { imported, skipped }),
        description: errors?.length ? errors.slice(0, 3).join("; ") : undefined,
        variant: errors?.length ? "destructive" : "success",
      });
    },
    onError: (e) => toast({ title: t("settings.siigo.toast.syncFailed"), description: errText(e), variant: "destructive" }),
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

      {/* Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("settings.team.cardTitle")}</CardTitle>
          <Button size="sm" onClick={() => setAddUserOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />{t("settings.team.btn.addUser")}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">{t("settings.team.hint")}</p>
          <div className="space-y-1.5">
            {(appUsers ?? []).map((u) => (
              <button key={u.id} onClick={() => openEditUser(u)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-7 w-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    u.role === "owner" ? "bg-amber-500" : "bg-slate-700"
                  }`}>
                    {(u.displayName ?? u.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.displayName ?? u.username}</p>
                    <p className="text-xs text-slate-400 truncate">@{u.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    u.role === "owner"      ? "bg-amber-100 text-amber-700"   :
                    u.role === "admin"      ? "bg-violet-100 text-violet-700" :
                    u.role === "manager"    ? "bg-blue-100 text-blue-700"     :
                    u.role === "accountant" ? "bg-emerald-100 text-emerald-700" :
                    "bg-slate-100 text-slate-500"
                  }`}>{roleLabel(u.role)}</span>
                  {!u.active && <Badge variant="secondary">{t("settings.team.badge.inactive")}</Badge>}
                </div>
              </button>
            ))}
            {!(appUsers ?? []).length && <p className="text-sm text-slate-400">{t("settings.team.empty")}</p>}
          </div>
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

      {/* Categories */}
      <Card>
        <CardHeader><CardTitle>{t("settings.categories.cardTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {/* Existing categories */}
          <div className="space-y-1">
            {(categories ?? []).filter((c) => c.active).map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
                {editingCat?.id === c.id ? (
                  <>
                    <Input
                      autoFocus
                      className="h-7 text-sm"
                      value={editingCat.name}
                      onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingCat.name.trim()) renameCat.mutate();
                        if (e.key === "Escape") setEditingCat(null);
                      }}
                    />
                    <button
                      disabled={!editingCat.name.trim() || renameCat.isPending}
                      onClick={() => renameCat.mutate()}
                      className="text-green-600 hover:text-green-700 disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditingCat(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-slate-800">{c.name}</span>
                    <button
                      onClick={() => setEditingCat({ id: c.id, name: c.name })}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmCat(c)}
                      className="text-slate-300 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
            {!(categories ?? []).filter((c) => c.active).length && (
              <p className="text-sm text-slate-400 py-1">{t("settings.categories.empty")}</p>
            )}
          </div>

          {/* Add new */}
          <div className="flex gap-2">
            <Input
              placeholder={t("settings.categories.placeholder.new")}
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newCatName.trim()) createCat.mutate(); }}
              className="text-sm"
            />
            <Button
              size="sm"
              disabled={!newCatName.trim() || createCat.isPending}
              onClick={() => createCat.mutate()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
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

      {/* Siigo / DIAN Integration */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("settings.siigo.cardTitle")}</CardTitle>
          {siigoConn && !siigoEditing && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={openSiigoEdit}><Pencil className="mr-1 h-3.5 w-3.5" /> {t("settings.siigo.btn.edit")}</Button>
              <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => setConfirmSiigo(true)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <Hint>{t("settings.siigo.hint")}</Hint>

          {!siigoConn && !siigoEditing ? (
            <Button variant="outline" onClick={openSiigoEdit}><Plus className="mr-1 h-4 w-4" /> {t("settings.siigo.btn.connect")}</Button>
          ) : siigoEditing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("settings.siigo.form.label.username")}</Label>
                <Input
                  type="email"
                  value={siigoForm.username}
                  onChange={(e) => setSiigoForm({ ...siigoForm, username: e.target.value })}
                  placeholder={t("settings.siigo.form.placeholder.username")}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{siigoConn ? t("settings.siigo.form.label.accessKeyCurrent") : t("settings.siigo.form.label.accessKey")}</Label>
                <div className="flex gap-2">
                  <Input
                    type={siigoKeyVisible ? "text" : "password"}
                    value={siigoForm.accessKey}
                    onChange={(e) => setSiigoForm({ ...siigoForm, accessKey: e.target.value })}
                    placeholder={siigoConn ? "•••••••••••••••" : t("settings.siigo.form.placeholder.accessKey")}
                  />
                  <Button size="icon" variant="outline" onClick={() => setSiigoKeyVisible(!siigoKeyVisible)}>
                    {siigoKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">{t("settings.siigo.form.hint.accessKey")}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSiigoEditing(false)}>{t("settings.siigo.form.btn.cancel")}</Button>
                <Button
                  disabled={!siigoForm.username.trim() || (!siigoConn && !siigoForm.accessKey.trim()) || saveSiigo.isPending}
                  onClick={() => saveSiigo.mutate()}
                >
                  {saveSiigo.isPending ? t("settings.siigo.form.btn.verifying") : t("settings.siigo.form.btn.save")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-100 divide-y divide-slate-100">
                {[
                  [t("settings.siigo.detail.field.username"), siigoConn!.username],
                  [t("settings.siigo.detail.field.lastSync"), siigoConn!.lastSyncAt ? formatDateTime(siigoConn!.lastSyncAt) : t("settings.siigo.detail.lastSync.never")],
                  [t("settings.siigo.detail.field.status"), siigoConn!.active ? t("settings.siigo.detail.status.active") : t("settings.siigo.detail.status.inactive")],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center gap-4 px-3 py-2 text-sm">
                    <span className="font-medium w-28 text-slate-600">{k}</span>
                    <span className="text-slate-900 truncate">{v}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" disabled={syncSiigo.isPending} onClick={() => syncSiigo.mutate()}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${syncSiigo.isPending ? "animate-spin" : ""}`} />
                {syncSiigo.isPending ? t("settings.siigo.btn.syncing") : t("settings.siigo.btn.syncNow")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add user dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("settings.team.createDialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{t("settings.team.createDialog.label.username")}</Label>
              <Input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder={t("settings.team.createDialog.placeholder.username")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.team.createDialog.label.displayName")} <span className="text-slate-400 text-xs">({t("common.optional")})</span></Label>
              <Input value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} placeholder={t("settings.team.createDialog.placeholder.displayName")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.team.createDialog.label.role")}</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES_FOR_SELECT(currentUser?.role ?? "admin").map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.team.createDialog.label.password")}</Label>
              <Input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddUserOpen(false)}>{t("settings.team.createDialog.btn.cancel")}</Button>
              <Button disabled={!newUser.username.trim() || !newUser.password || createUser.isPending} onClick={() => createUser.mutate()}>
                {createUser.isPending ? t("settings.team.createDialog.btn.adding") : t("settings.team.createDialog.btn.add")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editingUser} onOpenChange={(o) => { if (!o) setEditingUser(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("settings.team.editDialog.title")}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {editingUser?.role === "owner" && !isOwner && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                {t("settings.team.editDialog.ownerNote")}
              </p>
            )}
            <div className="space-y-1.5">
              <Label>{t("settings.team.editDialog.label.displayName")}</Label>
              <Input value={editUser.displayName} onChange={(e) => setEditUser({ ...editUser, displayName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.team.editDialog.label.role")}</Label>
              <Select
                value={editUser.role}
                disabled={editingUser?.role === "owner" && !isOwner}
                onValueChange={(v) => setEditUser({ ...editUser, role: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES_FOR_SELECT(currentUser?.role ?? "admin").map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.team.editDialog.label.newPassword")}</Label>
              <Input type="password" value={editUser.password} onChange={(e) => setEditUser({ ...editUser, password: e.target.value })} placeholder={t("settings.team.editDialog.placeholder.newPassword")} />
            </div>
            <div className="flex items-center justify-between pt-1">
              {editingUser && editingUser.id !== currentUser?.id && (
                editingUser.active ? (
                  <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={editingUser.role === "owner" && !isOwner}
                    onClick={() => updateUser.mutate({ active: false })}>
                    {t("settings.team.editDialog.btn.deactivate")}
                  </Button>
                ) : (
                  <Button variant="ghost" className="text-green-700 hover:bg-green-50"
                    onClick={() => updateUser.mutate({ active: true })}>
                    {t("settings.team.editDialog.btn.reactivate")}
                  </Button>
                )
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setEditingUser(null)}>{t("settings.team.editDialog.btn.cancel")}</Button>
                <Button disabled={updateUser.isPending} onClick={() => updateUser.mutate(undefined)}>
                  {updateUser.isPending ? t("settings.team.editDialog.btn.saving") : t("settings.team.editDialog.btn.save")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
      <ConfirmDialog
        open={confirmSiigo}
        onOpenChange={setConfirmSiigo}
        title={t("settings.siigo.disconnect.title")}
        description={t("settings.siigo.disconnect.description")}
        confirmLabel={t("settings.siigo.disconnect.confirmLabel")}
        destructive
        loading={deleteSiigo.isPending}
        onConfirm={() => { deleteSiigo.mutate(); setConfirmSiigo(false); }}
      />
      <ConfirmDialog
        open={!!confirmCat}
        onOpenChange={(o) => { if (!o) setConfirmCat(null); }}
        title={t("settings.categories.confirmDelete.title", { name: confirmCat?.name ?? "" })}
        description={t("settings.categories.confirmDelete.description")}
        confirmLabel={t("settings.categories.confirmDelete.confirmLabel")}
        destructive
        loading={deleteCat.isPending}
        onConfirm={() => confirmCat && deleteCat.mutate(confirmCat.id)}
      />
    </div>
  );
}
