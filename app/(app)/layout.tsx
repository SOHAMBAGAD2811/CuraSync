import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-screen" style={{ background: "#f8fafc" }}>
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile nav */}
        <MobileNav />

        <main
          className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto"
          style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f0fdf4 50%, #f0f9ff 100%)" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
