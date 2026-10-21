"use client";

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

export function Sidebar() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Patient";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-white border-r border-slate-200 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Heart className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-slate-900 tracking-tight">CuraSync</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
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

      {/* User profile & Footer */}
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
              <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
