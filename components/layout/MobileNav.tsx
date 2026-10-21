"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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

  const displayName =
    profile?.full_name || user?.email?.split("@")[0] || "Patient";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile topbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 md:hidden">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="CuraSync"
            width={100}
            height={32}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="CuraSync"
                  width={100}
                  height={32}
                  className="h-8 w-auto object-contain"
                />
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-sky-50 text-sky-700"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        active ? "text-sky-600" : "text-gray-400"
                      }`}
                    />
                    {label}
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="px-3 py-3 border-t border-gray-100 space-y-1">
              {user && (
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50">
                  <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 flex-shrink-0">
                    {initial || <User className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
              >
                <LogOut className="w-4 h-4 text-gray-400" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
