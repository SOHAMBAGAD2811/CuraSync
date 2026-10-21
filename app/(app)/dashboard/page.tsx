"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Package,
  TrendingUp,
  Loader2,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncTodayDoseOccurrences, acknowledgeDose } from "@/lib/doses";
import { TodayDate } from "@/components/dashboard/TodayDate";
import type { Database, DoseStatus } from "@/lib/types/database";

type DoseOccurrence = Database["public"]["Tables"]["dose_occurrences"]["Row"];
type Schedule = Database["public"]["Tables"]["medication_schedules"]["Row"];
type Medication = Database["public"]["Tables"]["medications"]["Row"];

interface FullDose extends DoseOccurrence {
  schedule?: Schedule & {
    medication?: Medication;
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doses, setDoses] = useState<FullDose[]>([]);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [compartmentMeds, setCompartmentMeds] = useState<{ [key: number]: string }>({});
  const [weeklyAdherence, setWeeklyAdherence] = useState<number>(100);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const supabase = createClient();

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Sync today's doses
      await syncTodayDoseOccurrences(user.id);

      // 2. Query today's doses
      const todayDate = new Date().toISOString().split("T")[0];
      const startOfDay = `${todayDate}T00:00:00.000Z`;
      const endOfDay = `${todayDate}T23:59:59.999Z`;

      const { data: doseData } = await supabase
        .from("dose_occurrences")
        .select("*, medication_schedules(*, medications(*))")
        .eq("patient_id", user.id)
        .gte("due_at", startOfDay)
        .lte("due_at", endOfDay)
        .order("due_at", { ascending: true });

      if (doseData) {
        const mapped: FullDose[] = doseData.map((d) => {
          const sched = d.medication_schedules as unknown as (Schedule & { medications: Medication });
          return {
            ...d,
            schedule: sched
              ? {
                  ...sched,
                  medication: sched.medications,
                }
              : undefined,
          };
        });
        setDoses(mapped);
      }

      // 3. Query active compartment assignments
      const { data: schedules } = await supabase
        .from("medication_schedules")
        .select("compartment_number, medications(name)")
        .eq("patient_id", user.id)
        .eq("is_active", true);

      const compMap: { [key: number]: string } = {};
      if (schedules) {
        schedules.forEach((s) => {
          const med = s.medications as unknown as { name: string } | null;
          if (med?.name) {
            compMap[s.compartment_number] = med.name;
          }
        });
      }
      setCompartmentMeds(compMap);

      // 4. Query device status
      const { data: device } = await supabase
        .from("devices")
        .select("*")
        .eq("patient_id", user.id)
        .maybeSingle();

      if (device?.last_heartbeat_at) {
        setLastHeartbeat(device.last_heartbeat_at);
        const diffMs = Date.now() - new Date(device.last_heartbeat_at).getTime();
        setDeviceOnline(diffMs < 5 * 60 * 1000); // online if heartbeat within 5 mins
      } else {
        setDeviceOnline(false);
      }

      // 5. Query weekly adherence (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: pastDoses } = await supabase
        .from("dose_occurrences")
        .select("status")
        .eq("patient_id", user.id)
        .gte("due_at", sevenDaysAgo);

      if (pastDoses && pastDoses.length > 0) {
        const takenCount = pastDoses.filter(
          (d) => d.status === "acknowledged" || d.status === "late"
        ).length;
        setWeeklyAdherence(Math.round((takenCount / pastDoses.length) * 100));
      } else {
        setWeeklyAdherence(100);
      }
    } catch (e) {
      console.error("Dashboard data load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleTakeDose = async (doseId: string) => {
    setMarkingId(doseId);
    await acknowledgeDose(doseId);
    await loadDashboardData();
    setMarkingId(null);
  };

  // Stats calculations
  const takenToday = doses.filter(
    (d) => d.status === "acknowledged" || d.status === "late"
  ).length;
  const missedToday = doses.filter((d) => d.status === "missed").length;
  const upcomingToday = doses.filter(
    (d) => d.status === "scheduled" || d.status === "pending"
  ).length;

  // Next dose
  const nextDose = doses.find(
    (d) => d.status === "scheduled" || d.status === "pending"
  );

  const formatDueTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <TodayDate />
        </div>
        <button
          onClick={() => loadDashboardData()}
          disabled={loading}
          className="text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-2xs">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Taken today</p>
            <p className="text-2xl font-bold text-slate-900">{takenToday}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-2xs">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-50 text-red-500">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Missed today</p>
            <p className="text-2xl font-bold text-slate-900">{missedToday}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-2xs">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Upcoming</p>
            <p className="text-2xl font-bold text-slate-900">{upcomingToday}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-2xs">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-violet-50 text-violet-600">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Week adherence</p>
            <p className="text-2xl font-bold text-slate-900">{weeklyAdherence}%</p>
          </div>
        </div>
      </div>

      {/* Next dose banner */}
      {nextDose ? (
        <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-2xl p-5 flex items-center justify-between text-white shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 backdrop-blur-xs">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-100 uppercase tracking-wider">
                Next Dose
              </p>
              <p className="text-lg font-bold">
                {nextDose.schedule?.medication?.name || "Medication"}
                {nextDose.schedule?.medication?.dosage
                  ? ` (${nextDose.schedule.medication.dosage})`
                  : ""}
              </p>
              <p className="text-xs text-sky-100 mt-0.5">
                Compartment {nextDose.schedule?.compartment_number || 1} · Due at{" "}
                {formatDueTime(nextDose.due_at)}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleTakeDose(nextDose.id)}
            disabled={markingId === nextDose.id}
            className="px-4 py-2 bg-white text-sky-700 text-sm font-semibold rounded-xl hover:bg-sky-50 transition-colors shadow-xs disabled:opacity-50"
          >
            {markingId === nextDose.id ? "Recording..." : "Mark Taken"}
          </button>
        </div>
      ) : (
        <div className="bg-emerald-500 rounded-2xl p-5 flex items-center gap-4 text-white shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold">All caught up for today!</p>
            <p className="text-xs text-emerald-100 mt-0.5">
              No further pending doses scheduled for today.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Today's schedule */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">
            Today&apos;s Medication Schedule
          </h2>

          {loading ? (
            <div className="p-8 flex justify-center items-center">
              <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
            </div>
          ) : doses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No doses scheduled for today. Add medicines in the Medicines tab.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {doses.map((dose) => {
                const medName = dose.schedule?.medication?.name || "Medicine";
                const compartment = dose.schedule?.compartment_number || 1;
                const status = dose.status;

                const statusBadge = {
                  scheduled: { label: "Scheduled", bg: "bg-blue-50 text-blue-700" },
                  pending: { label: "Pending", bg: "bg-amber-50 text-amber-700" },
                  acknowledged: { label: "Taken", bg: "bg-emerald-50 text-emerald-700" },
                  late: { label: "Late", bg: "bg-orange-50 text-orange-700" },
                  missed: { label: "Missed", bg: "bg-red-50 text-red-700" },
                }[status];

                const canMark = status === "scheduled" || status === "pending";

                return (
                  <div
                    key={dose.id}
                    className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-xs font-bold text-sky-700">
                        C{compartment}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {medName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDueTime(dose.due_at)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge.bg}`}
                      >
                        {statusBadge.label}
                      </span>
                      {canMark && (
                        <button
                          onClick={() => handleTakeDose(dose.id)}
                          disabled={markingId === dose.id}
                          className="p-1.5 rounded-lg border border-emerald-300 text-emerald-600 hover:bg-emerald-50 text-xs font-medium"
                          title="Mark taken"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ESP32 Device & Compartments */}
        <div className="space-y-4">
          {/* Device status */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-800">
                ESP32 Hardware Reminder
              </h2>
              <div
                className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  deviceOnline
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {deviceOnline ? (
                  <Wifi className="w-3 h-3 text-emerald-600" />
                ) : (
                  <WifiOff className="w-3 h-3 text-slate-400" />
                )}
                {deviceOnline ? "Online" : "Offline"}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {deviceOnline
                ? `Active & synchronized (last heartbeat: ${new Date(lastHeartbeat!).toLocaleTimeString()})`
                : "No recent heartbeat received from physical device."}
            </p>
          </div>

          {/* 3 Physical Compartments */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-800">
                Physical Compartments
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((compNum) => {
                const medName = compartmentMeds[compNum];
                return (
                  <div
                    key={compNum}
                    className="rounded-xl border border-slate-200 p-4 flex flex-col items-center gap-1.5 bg-slate-50/50 text-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-bold shadow-2xs">
                      C{compNum}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 truncate w-full">
                      {medName || "Empty"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {medName ? "Configured" : "Available"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
