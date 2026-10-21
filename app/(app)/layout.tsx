import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile nav */}
        <MobileNav />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
