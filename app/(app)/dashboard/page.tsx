"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  TrendingUp,
  Loader2,
  Check,
  RefreshCw,
  Filter,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncTodayDoseOccurrences, acknowledgeDose } from "@/lib/doses";
import { TodayDate } from "@/components/dashboard/TodayDate";
import { NextDoseHero, type FullDose } from "@/components/dashboard/NextDoseHero";
import {
  DispenserVisualizer,
  type CompartmentDetail,
} from "@/components/dashboard/DispenserVisualizer";
import type { Database, CompartmentNumber, DoseStatus } from "@/lib/types/database";

type Device = Database["public"]["Tables"]["devices"]["Row"];
type Schedule = Database["public"]["Tables"]["medication_schedules"]["Row"];
type Medication = Database["public"]["Tables"]["medications"]["Row"];

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [doses, setDoses] = useState<FullDose[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [deviceOnline, setDeviceOnline] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);
  const [compartmentDetails, setCompartmentDetails] = useState<
    Record<number, CompartmentDetail>
  >({});
  const [weeklyAdherence, setWeeklyAdherence] = useState<number>(100);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "upcoming" | "taken" | "missed">("all");
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

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

      let mappedDoses: FullDose[] = [];
      if (doseData) {
        mappedDoses = doseData.map((d) => {
          const sched = d.medication_schedules as unknown as (Schedule & {
            medications: Medication;
          });
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
        setDoses(mappedDoses);
      }

      // 3. Query active schedules & build compartment details
      const { data: schedules } = await supabase
        .from("medication_schedules")
        .select("id, compartment_number, scheduled_time, medications(id, name, dosage, instructions)")
        .eq("patient_id", user.id)
        .eq("is_active", true);

      const compMap: Record<number, CompartmentDetail> = {};
      [1, 2, 3].forEach((compNum) => {
        const sched = schedules?.find((s) => s.compartment_number === compNum);
        const med = sched?.medications as unknown as {
          name: string;
          dosage?: string;
          instructions?: string;
        } | null;

        // Check doses for this compartment today
        const compDoses = mappedDoses.filter(
          (d) => d.schedule?.compartment_number === compNum
        );

        const hasPending = compDoses.some(
          (d) =>
            d.status === "pending" ||
            (d.status === "scheduled" && new Date(d.due_at) <= new Date())
        );

        const hasTaken = compDoses.some(
          (d) => d.status === "acknowledged" || d.status === "late"
        );

        const activeDose = compDoses.find(
          (d) => d.status === "pending" || d.status === "scheduled"
        );

        compMap[compNum] = {
          compNum: compNum as CompartmentNumber,
          medName: med?.name || null,
          dosage: med?.dosage || null,
          instructions: med?.instructions || null,
          scheduledTime: sched?.scheduled_time || null,
          hasPendingDose: hasPending,
          hasTakenToday: hasTaken,
          activeDoseId: activeDose?.id || null,
        };
      });
      setCompartmentDetails(compMap);

      // 4. Query device status
      let { data: dev } = await supabase
        .from("devices")
        .select("*")
        .eq("patient_id", user.id)
        .maybeSingle();

      if (!dev) {
        // Auto-provision default ESP32 dispenser if not yet created
        const generatedKey = `cs_dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
        const { data: created } = await supabase
          .from("devices")
          .insert({
            patient_id: user.id,
            device_key: generatedKey,
            label: "ESP32 Dispenser Unit",
          })
          .select()
          .single();
        dev = created;
      }

      setDevice(dev);

      if (dev?.last_heartbeat_at) {
        setLastHeartbeat(dev.last_heartbeat_at);
        const diffMs = Date.now() - new Date(dev.last_heartbeat_at).getTime();
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

  // Mark dose taken manually via web UI
  const handleTakeDose = async (doseId: string) => {
    setMarkingId(doseId);
    await acknowledgeDose(doseId);
    await loadDashboardData();
    setMarkingId(null);
    setStatusNotification("Dose successfully marked as taken! Dispenser LED updated.");
    setTimeout(() => setStatusNotification(null), 4000);
  };

  // Simulate hardware reed switch lid open
  const handleTriggerLidOpen = async (compNum: CompartmentNumber) => {
    if (!device) return;
    setSimulating(true);

    try {
      const res = await fetch("/api/device/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_key: device.device_key,
          event_type: "compartment_open",
          compartment_number: compNum,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusNotification(
          data.dose_acknowledged
            ? `Compartment ${compNum} lid opened! Matching dose acknowledged and LED turned off.`
            : `Compartment ${compNum} reed switch triggered event logged.`
        );
      }
      await loadDashboardData();
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setSimulating(false);
      setTimeout(() => setStatusNotification(null), 5000);
    }
  };

  // Stats calculations
  const takenToday = doses.filter(
    (d) => d.status === "acknowledged" || d.status === "late"
  ).length;
  const missedToday = doses.filter((d) => d.status === "missed").length;
  const upcomingToday = doses.filter(
    (d) => d.status === "scheduled" || d.status === "pending"
  ).length;

  // Filtered doses for today's list
  const filteredDoses = useMemo(() => {
    switch (filterTab) {
      case "upcoming":
        return doses.filter(
          (d) => d.status === "scheduled" || d.status === "pending"
        );
      case "taken":
        return doses.filter(
          (d) => d.status === "acknowledged" || d.status === "late"
        );
      case "missed":
        return doses.filter((d) => d.status === "missed");
      case "all":
      default:
        return doses;
    }
  }, [doses, filterTab]);

  const formatDueTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const getLedIndicatorForComp = (compNum: number = 1) => {
    switch (compNum) {
      case 1:
        return {
          name: "Red LED",
          bg: "bg-red-50 text-red-700 border-red-200",
          dot: "bg-red-500",
        };
      case 2:
        return {
          name: "Green LED",
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
          dot: "bg-emerald-500",
        };
      case 3:
      default:
        return {
          name: "White LED",
          bg: "bg-slate-100 text-slate-700 border-slate-300",
          dot: "bg-slate-400 border border-slate-500",
        };
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            CuraSync Dashboard
          </h1>
          <TodayDate />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDashboardData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border border-sky-200 text-sky-700 bg-sky-50/80 hover:bg-sky-100/80 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Syncing..." : "Refresh Status"}
          </button>
        </div>
      </div>

      {/* Real-time Status Toast Notification */}
      {statusNotification && (
        <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="font-medium">{statusNotification}</p>
          </div>
          <button
            onClick={() => setStatusNotification(null)}
            className="text-xs text-emerald-700 font-bold hover:underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Next Dose Spotlight Hero Card */}
      <NextDoseHero
        doses={doses}
        onMarkTaken={handleTakeDose}
        markingId={markingId}
      />

      {/* 2. Interactive Physical Dispenser Console */}
      <DispenserVisualizer
        deviceOnline={deviceOnline}
        lastHeartbeat={lastHeartbeat}
        deviceKey={device?.device_key}
        doses={doses}
        compartmentDetails={compartmentDetails}
        onTriggerLidOpen={handleTriggerLidOpen}
        isSimulating={simulating}
      />

      {/* 3. Daily Stats KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Taken Today */}
        <div className="rounded-2xl p-4 flex items-center gap-3.5 bg-white border border-emerald-100 shadow-xs">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Taken Today</p>
            <p className="text-2xl font-black text-slate-900">{takenToday}</p>
          </div>
        </div>

        {/* Missed Today */}
        <div className="rounded-2xl p-4 flex items-center gap-3.5 bg-white border border-rose-100 shadow-xs">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-rose-50 text-rose-600 border border-rose-200">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Missed Today</p>
            <p className="text-2xl font-black text-slate-900">{missedToday}</p>
          </div>
        </div>

        {/* Upcoming */}
        <div className="rounded-2xl p-4 flex items-center gap-3.5 bg-white border border-sky-100 shadow-xs">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-sky-50 text-sky-600 border border-sky-200">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Upcoming</p>
            <p className="text-2xl font-black text-slate-900">{upcomingToday}</p>
          </div>
        </div>

        {/* 7-Day Adherence */}
        <div className="rounded-2xl p-4 flex items-center gap-3.5 bg-white border border-indigo-100 shadow-xs">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600 border border-indigo-200">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">7-Day Adherence</p>
            <p className="text-2xl font-black text-slate-900">{weeklyAdherence}%</p>
          </div>
        </div>
      </div>

      {/* 4. Today's Full Schedule with Filter Tabs */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        {/* Schedule Header & Filter Tabs */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Today&apos;s Medication Timeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review completed doses, upcoming alarms, and compartment assignments
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterTab === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({doses.length})
            </button>
            <button
              onClick={() => setFilterTab("upcoming")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterTab === "upcoming"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Upcoming ({upcomingToday})
            </button>
            <button
              onClick={() => setFilterTab("taken")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                filterTab === "taken"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Taken ({takenToday})
            </button>
            {missedToday > 0 && (
              <button
                onClick={() => setFilterTab("missed")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterTab === "missed"
                    ? "bg-white text-rose-700 shadow-xs"
                    : "text-slate-600 hover:text-rose-700"
                }`}
              >
                Missed ({missedToday})
              </button>
            )}
          </div>
        </div>

        {/* Schedule List */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
            <p className="text-xs text-slate-500">Loading daily schedule...</p>
          </div>
        ) : filteredDoses.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 px-4">
            {filterTab === "all"
              ? "No medication doses scheduled for today. Add medicines in the Medicines tab."
              : `No ${filterTab} doses found for today.`}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDoses.map((dose) => {
              const medName = dose.schedule?.medication?.name || "Medicine";
              const dosage = dose.schedule?.medication?.dosage;
              const compNum = dose.schedule?.compartment_number || 1;
              const led = getLedIndicatorForComp(compNum);
              const status = dose.status;

              const statusBadge: Record<
                DoseStatus,
                { label: string; bg: string; color: string }
              > = {
                scheduled: { label: "Scheduled", bg: "bg-blue-50 text-blue-700 border-blue-200", color: "#1d4ed8" },
                pending: { label: "Due Now", bg: "bg-amber-50 text-amber-700 border-amber-300 animate-pulse", color: "#b45309" },
                acknowledged: { label: "Taken", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", color: "#15803d" },
                late: { label: "Taken Late", bg: "bg-orange-50 text-orange-700 border-orange-200", color: "#c2410c" },
                missed: { label: "Missed", bg: "bg-rose-50 text-rose-700 border-rose-200", color: "#b91c1c" },
              };

              const currentBadge = statusBadge[status];
              const canMark = status === "scheduled" || status === "pending";

              return (
                <div
                  key={dose.id}
                  className="flex items-center justify-between p-4 sm:px-6 hover:bg-slate-50/70 transition-colors"
                >
                  {/* Left: Compartment LED badge + Med info */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    {/* Compartment Chip */}
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        C{compNum}
                      </div>
                      <span className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-slate-500">
                        <span className={`w-1.5 h-1.5 rounded-full ${led.dot}`} />
                        {led.name.split(" ")[0]}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {medName}
                        </p>
                        {dosage && (
                          <span className="text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                            {dosage}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Due at {formatDueTime(dose.due_at)}</span>
                        {dose.acknowledged_at && (
                          <span className="text-emerald-600 font-medium">
                            • Taken at {new Date(dose.acknowledged_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right: Status badge & Take action */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${currentBadge.bg}`}
                    >
                      {currentBadge.label}
                    </span>

                    {canMark && (
                      <button
                        onClick={() => handleTakeDose(dose.id)}
                        disabled={markingId === dose.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Mark dose acknowledged"
                      >
                        {markingId === dose.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">
                          {markingId === dose.id ? "Saving..." : "Take"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
