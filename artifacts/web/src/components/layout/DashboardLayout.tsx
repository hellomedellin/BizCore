import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Warehouse, ShoppingCart,
  Users, Clock, Calendar, Truck, Building2,
  Cog, ChevronLeft, ChevronRight, BookUser,
  Tag, UtensilsCrossed, Carrot, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LocationProvider, LocationSwitcher } from "@/hooks/useLocation";
import { useT, useLang } from "@/lib/i18n";

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string;
  groupKey?: string;
}

const NAV: NavItem[] = [
  { labelKey: "nav.dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "nav.menu",        href: "/dashboard/menu",         icon: UtensilsCrossed, module: "inventory",    groupKey: "nav.group.operations" },
  { labelKey: "nav.ingredients", href: "/dashboard/ingredients",  icon: Carrot,          module: "inventory",    groupKey: "nav.group.operations" },
  { labelKey: "nav.stock",       href: "/dashboard/stock",        icon: Warehouse,       module: "inventory",    groupKey: "nav.group.operations" },
  { labelKey: "nav.sales",       href: "/dashboard/sales",        icon: ShoppingCart,    module: "orders",       groupKey: "nav.group.operations" },
  { labelKey: "nav.customers",   href: "/dashboard/customers",    icon: BookUser,        module: "customers",    groupKey: "nav.group.operations" },
  { labelKey: "nav.suppliers",   href: "/dashboard/suppliers",    icon: Tag,             module: "purchasing",   groupKey: "nav.group.purchasing" },
  { labelKey: "nav.purchases",   href: "/dashboard/purchasing",   icon: Truck,           module: "purchasing",   groupKey: "nav.group.purchasing" },
  { labelKey: "nav.employees",   href: "/dashboard/employees",    icon: Users,           module: "employees",    groupKey: "nav.group.team" },
  { labelKey: "nav.scheduling",  href: "/dashboard/scheduling",   icon: Calendar,        module: "scheduling",   groupKey: "nav.group.team" },
  { labelKey: "nav.timeTracking",href: "/dashboard/time-tracking",icon: Clock,           module: "time_tracking",groupKey: "nav.group.team" },
  { labelKey: "nav.settings",    href: "/dashboard/settings",     icon: Cog },
];

function NavLink({ item, collapsed, t }: { item: NavItem; collapsed: boolean; t: ReturnType<typeof useT> }) {
  const [active] = useRoute(item.href);
  return (
    <Link href={item.href}>
      <span className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer",
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        collapsed && "justify-center px-2"
      )}>
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{t(item.labelKey as any)}</span>}
      </span>
    </Link>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const t = useT();
  const { lang, setLang } = useLang();
  const { user, logout } = useAuth();

  const { data: modules } = useQuery({
    queryKey: ["modules"],
    queryFn: () => api.get("/modules").then((r) => r.data as Array<{ module: string; enabled: boolean }>),
  });

  const enabledModules = new Set(modules?.filter((m) => m.enabled).map((m) => m.module) ?? []);
  const visibleNav = NAV.filter((item) => !item.module || enabledModules.has(item.module));

  return (
    <LocationProvider>
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-slate-200 bg-white transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}>
        {/* Logo */}
        <div className={cn("flex h-14 items-center border-b border-slate-200 px-3", collapsed && "justify-center")}>
          {collapsed ? (
            <Building2 className="h-6 w-6 text-slate-900" />
          ) : (
            <span className="font-bold text-slate-900 text-lg">BizCore</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {visibleNav.reduce<React.ReactNode[]>((acc, item, idx) => {
            const prevGroupKey = idx > 0 ? visibleNav[idx - 1]?.groupKey : undefined;
            if (item.groupKey && item.groupKey !== prevGroupKey && !collapsed) {
              acc.push(
                <p key={`group-${item.groupKey}`} className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {t(item.groupKey as any)}
                </p>
              );
            }
            acc.push(<NavLink key={item.href} item={item} collapsed={collapsed} t={t} />);
            return acc;
          }, [])}
        </nav>

        {/* User / language / collapse */}
        <div className={cn("flex items-center border-t border-slate-200 p-2", collapsed ? "flex-col gap-2" : "justify-between")}>
          <button
            onClick={logout}
            title={user?.username ?? "Sign out"}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            {!collapsed && (
              <button
                onClick={() => setLang(lang === "es" ? "en" : "es")}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title={lang === "es" ? "Switch to English" : "Cambiar a Español"}
              >
                {t("nav.lang")}
              </button>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex h-14 items-center justify-end border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
          <LocationSwitcher />
        </div>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
    </LocationProvider>
  );
}
