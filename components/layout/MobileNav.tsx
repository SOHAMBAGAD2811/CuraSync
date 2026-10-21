"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Pill,
  CalendarDays,
  BarChart3,
  Bell,
  HeartPulse,
  Cpu,
  Users,
  Settings,
  Heart,
  Menu,
  X,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/medicines", label: "Medicines", icon: Pill },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/health", label: "Health Records", icon: HeartPulse },
  { href: "/device", label: "Device", icon: Cpu },
  { href: "/caregiver", label: "Caregiver", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();

  const currentPage =
    navItems.find(
      (item) => pathname === item.href || pathname.startsWith(item.href + "/")
    )?.label ?? "CuraSync";

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Patient";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile topbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 md:hidden">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center shadow-sm">
            <Heart className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-slate-900">
            {currentPage}
          </span>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-base font-bold text-slate-900">
                  CuraSync
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-sky-50 text-sky-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${active ? "text-sky-600" : "text-slate-400"}`}
                    />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="px-3 py-4 border-t border-slate-100 space-y-2">
              {user && (
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 flex-shrink-0">
                    {initial || <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
