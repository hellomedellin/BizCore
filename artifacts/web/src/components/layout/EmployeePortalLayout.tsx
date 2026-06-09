import { Link, useRoute } from "wouter";
import { UserButton } from "@clerk/react";
import { Home, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Home", href: "/me", icon: Home },
  { label: "Schedule", href: "/me/schedule", icon: Calendar },
  { label: "Time Off", href: "/me/time-off", icon: Clock },
];

export function EmployeePortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <span className="font-bold text-slate-900">BizCore — My Portal</span>
        <UserButton afterSignOutUrl="/" />
      </header>

      {/* Content */}
      <main className="flex-1 p-4">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sticky bottom-0 flex border-t border-slate-200 bg-white">
        {NAV.map((item) => {
          const [active] = useRoute(item.href);
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <span className={cn(
                "flex flex-col items-center gap-1 py-2 text-xs transition-colors cursor-pointer",
                active ? "text-slate-900 font-semibold" : "text-slate-500"
              )}>
                <item.icon className="h-5 w-5" />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
