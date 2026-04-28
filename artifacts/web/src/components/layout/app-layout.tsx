import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-muted/10">
      <Sidebar />
      <div className="flex flex-col sm:gap-4 sm:pl-14 w-full sm:pl-0">
        <Topbar />
        <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 overflow-y-auto mt-6">
          {children}
        </main>
      </div>
    </div>
  );
}
