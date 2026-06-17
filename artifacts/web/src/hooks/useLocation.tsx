import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface LocationLite {
  id: string;
  name: string;
  active?: boolean;
}

interface LocationCtx {
  locations: LocationLite[];
  // null = "All locations"
  activeLocationId: string | null;
  setActiveLocationId: (id: string | null) => void;
  ready: boolean;
}

const Ctx = React.createContext<LocationCtx | null>(null);
const STORAGE_KEY = "bizcore.activeLocationId";

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { data: locations = [], isSuccess } = useQuery({
    queryKey: ["locations"],
    queryFn: () => api.get("/locations").then((r) => r.data as LocationLite[]),
  });
  const active = locations.filter((l) => l.active !== false);

  const [stored, setStored] = React.useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  // Resolve the effective selection. Stay null until locations load so no query
  // fires with a stale/foreign stored id (the storage key is shared across logins,
  // so a prior tenant's id could leak in). One location → always that one; with
  // several, honor the stored id only if it's actually in the active set.
  let activeLocationId: string | null = null;
  if (isSuccess) {
    if (active.length === 1) activeLocationId = active[0]!.id;
    else if (stored && active.some((l) => l.id === stored)) activeLocationId = stored;
  }

  const setActiveLocationId = React.useCallback((id: string | null) => {
    setStored(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value: LocationCtx = { locations: active, activeLocationId, setActiveLocationId, ready: isSuccess };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocationContext(): LocationCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useLocationContext must be used within a LocationProvider");
  return ctx;
}

// Header control. With one location it's a static label (no pointless prompt);
// with several it's a switcher that includes "All locations".
export function LocationSwitcher() {
  const { locations, activeLocationId, setActiveLocationId } = useLocationContext();

  if (locations.length === 0) return null;
  if (locations.length === 1) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-slate-600">
        <MapPin className="h-4 w-4 text-slate-400" />
        {locations[0]!.name}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-slate-400" />
      <Select value={activeLocationId ?? "all"} onValueChange={(v) => setActiveLocationId(v === "all" ? null : v)}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All locations</SelectItem>
          {locations.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
