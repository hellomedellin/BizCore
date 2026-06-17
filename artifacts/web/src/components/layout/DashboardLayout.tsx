import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { UserButton } from "@clerk/react";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart,
  Users, Clock, Calendar, Truck, Building2,
  Cog, ChevronLeft, ChevronRight, Layers, BookUser,
  Tag, FileText, UtensilsCrossed, Carrot,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: string;
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed, module: "inventory" },
  { label: "Ingredients", href: "/dashboard/ingredients", icon: Carrot, module: "inventory" },
  { label: "Inventory", href: "/dashboard/inventory", icon: Warehouse, module: "inventory" },
  { label: "Consumption Profiles", href: "/dashboard/consumption-profiles", icon: Layers, module: "consumption_profiles" },
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart, module: "orders" },
  { label: "Customers", href: "/dashboard/customers", icon: BookUser, module: "customers" },
  { label: "Employees", href: "/dashboard/employees", icon: Users, module: "employees" },
  { label: "Time Tracking", href: "/dashboard/time-tracking", icon: Clock, module: "time_tracking" },
  { label: "Scheduling", href: "/dashboard/scheduling", icon: Calendar, module: "scheduling" },
  { label: "Suppliers", href: "/dashboard/suppliers", icon: Tag, module: "purchasing" },
  { label: "Purchasing", href: "/dashboard/purchasing", icon: Truck, module: "purchasing" },
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
          {visibleNav.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
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
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
