import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Settings, 
  MapPin, 
  ShoppingBag, 
  Package, 
  Tag,
  Users, 
  Calendar, 
  Clock, 
  BarChart3,
  Loader2
} from "lucide-react";
import { useGetModules } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Sidebar() {
  const [location] = useLocation();
  const { data: modules, isLoading } = useGetModules();

  const isModuleEnabled = (moduleName: string) => {
    return modules?.some(m => m.module === moduleName && m.enabled) || false;
  };

  const isActive = (path: string) => {
    // If we're using a base path, wouter's useLocation includes it in some setups, or we might need to handle it.
    // Assuming wouter useLocation returns the path without base if properly configured with <Router base={basePath}>
    return location === path || location.startsWith(`${path}/`);
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, alwaysVisible: true },
    { name: "Orders", path: "/orders", icon: ShoppingBag, module: "orders" },
    { name: "Items", path: "/items", icon: Tag, module: "inventory" },
    { name: "Inventory", path: "/inventory", icon: Package, module: "inventory" },
    { name: "Employees", path: "/employees", icon: Users, module: "employees" },
    { name: "Schedule", path: "/schedule", icon: Calendar, module: "scheduling" },
    { name: "Time Tracking", path: "/time-tracking", icon: Clock, module: "time_tracking" },
    { name: "Reports", path: "/reports", icon: BarChart3, module: "reports" },
    { name: "Locations", path: "/locations", icon: MapPin, alwaysVisible: true },
    { name: "Settings", path: "/settings", icon: Settings, alwaysVisible: true },
  ];

  return (
    <aside className="hidden w-64 flex-col border-r bg-sidebar sm:flex">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <img src={`${basePath}/logo.svg`} alt="BizCore Logo" className="h-6 w-6 rounded-md" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">BizCore</span>
        </Link>
      </div>
      
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-2 text-sm font-medium">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            navItems.map((item) => {
              const shouldShow = item.alwaysVisible || (item.module && isModuleEnabled(item.module));
              
              if (!shouldShow) return null;
              
              const Icon = item.icon;
              return (
                <Link 
                  key={item.path} 
                  href={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 my-0.5 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive(item.path) ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground" : ""
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })
          )}
        </nav>
      </div>
    </aside>
  );
}
