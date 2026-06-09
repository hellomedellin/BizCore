import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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

export function SettingsPage() {
  const qc = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyOpen, setNewKeyOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: business } = useQuery({
    queryKey: ["business"],
    queryFn: () => api.get("/businesses/me").then((r) => r.data),
  });

  const { data: locations } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data),
  });

  const { data: modules } = useQuery({
    queryKey: ["modules"],
    queryFn: () => api.get("/modules").then((r) => r.data as Array<{ module: string; enabled: boolean }>),
  });

  const { data: apiKeys } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.get("/api-keys").then((r) => r.data),
  });

  const toggleModule = useMutation({
    mutationFn: ({ module, enabled }: { module: string; enabled: boolean }) =>
      api.put("/modules/bulk", { modules: [{ module, enabled }] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modules"] }),
  });

  const createKey = useMutation({
    mutationFn: () => api.post("/api-keys", { name: newKeyName, scopes: ["orders:write", "orders:read"] }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setCreatedKey(res.data.key);
      setNewKeyName("");
    },
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => api.patch(`/api-keys/${id}`, { active: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const enabledSet = new Set((modules ?? []).filter((m) => m.enabled).map((m) => m.module));

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      {/* Business Info */}
      <Card>
        <CardHeader><CardTitle>Business</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium w-32 text-slate-600">Name</span>
            <span>{business?.name}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium w-32 text-slate-600">Currency</span>
            <span>{business?.currencyCode}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium w-32 text-slate-600">Timezone</span>
            <span>{business?.timezone}</span>
          </div>
        </CardContent>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(locations ?? []).map((loc: any) => (
            <div key={loc.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
              <div>
                <p className="font-medium text-sm">{loc.name}</p>
                <p className="text-xs text-slate-500 capitalize">{loc.type} · {loc.timezone}</p>
              </div>
              <Badge variant={loc.active ? "success" : "secondary"}>{loc.active ? "Active" : "Inactive"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Modules */}
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
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                      Copy this key now — it will not be shown again.
                    </p>
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
                  <button onClick={() => revokeKey.mutate(key.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
