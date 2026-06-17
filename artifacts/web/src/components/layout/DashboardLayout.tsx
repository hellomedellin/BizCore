import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UserButton } from "@clerk/react";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Warehouse, ShoppingCart,
  Users, Clock, Calendar, Truck, Building2,
  Cog, ChevronLeft, ChevronRight, BookUser,
  Tag, UtensilsCrossed, Carrot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LocationProvider, LocationSwitcher } from "@/hooks/useLocation";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string;
  group?: string;
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  // Operations
  { label: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed, module: "inventory", group: "Operations" },
  { label: "Ingredients", href: "/dashboard/ingredients", icon: Carrot, module: "inventory", group: "Operations" },
  { label: "Stock", href: "/dashboard/stock", icon: Warehouse, module: "inventory", group: "Operations" },
  { label: "Sales", href: "/dashboard/sales", icon: ShoppingCart, module: "orders", group: "Operations" },
  { label: "Customers", href: "/dashboard/customers", icon: BookUser, module: "customers", group: "Operations" },
  // Purchasing
  { label: "Suppliers", href: "/dashboard/suppliers", icon: Tag, module: "purchasing", group: "Purchasing" },
  { label: "Purchases", href: "/dashboard/purchasing", icon: Truck, module: "purchasing", group: "Purchasing" },
  // Team
  { label: "Employees", href: "/dashboard/employees", icon: Users, module: "employees", group: "Team" },
  { label: "Scheduling", href: "/dashboard/scheduling", icon: Calendar, module: "scheduling", group: "Team" },
  { label: "Time Tracking", href: "/dashboard/time-tracking", icon: Clock, module: "time_tracking", group: "Team" },
  // System
  { label: "Settings", href: "/dashboard/settings", icon: Cog },
];

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [active] = useRoute(item.href);
  return (
    <Link href={item.href}>
      <span className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer",
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        collapsed && "justify-center px-2"
      )}>
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </span>
    </Link>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

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
            const prevGroup = idx > 0 ? visibleNav[idx - 1]?.group : undefined;
            if (item.group && item.group !== prevGroup && !collapsed) {
              acc.push(
                <p key={`group-${item.group}`} className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {item.group}
                </p>
              );
            }
            acc.push(<NavLink key={item.href} item={item} collapsed={collapsed} />);
            return acc;
          }, [])}
        </nav>

        {/* User / collapse */}
        <div className={cn("flex items-center border-t border-slate-200 p-2", collapsed ? "flex-col gap-2" : "justify-between")}>
          <UserButton />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
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
