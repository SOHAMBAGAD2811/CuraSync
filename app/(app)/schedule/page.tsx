"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Clock, Pill, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Database } from "@/lib/types/database";

type Schedule = Database["public"]["Tables"]["medication_schedules"]["Row"];
type Medication = Database["public"]["Tables"]["medications"]["Row"];

interface ScheduleWithMed extends Schedule {
  medication?: Medication;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(t: string) {
  if (!t) return "";
  const parts = t.split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleWithMed[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayIndex, setTodayIndex] = useState<number>(0);
  const [todayDateString, setTodayDateString] = useState<string>("");

  const supabase = createClient();

  const fetchSchedule = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("medication_schedules")
      .select("*, medications(*)")
      .eq("patient_id", user.id)
      .eq("is_active", true)
      .order("scheduled_time", { ascending: true });

    if (!error && data) {
      setSchedules(
        data.map((item) => ({
          ...item,
          medication: item.medications as Medication,
        }))
      );
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    const now = new Date();
    setTodayIndex(now.getDay());
    setTodayDateString(
      now.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    );
    fetchSchedule();
  }, [fetchSchedule]);

  const todaySchedules = schedules.filter((s) =>
    s.days_of_week.includes(todayIndex)
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Daily and weekly timetable mapped to your physical compartments
        </p>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            No active schedules found
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Head to the Medicines page to add prescriptions and configure reminder schedules.
          </p>
        </div>
      ) : (
        <>
          {/* Weekly grid */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-800">Weekly View</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3 text-xs font-semibold text-slate-600 w-52">
                      Medicine & Compartment
                    </th>
                    <th className="px-3 py-3 text-xs font-semibold text-slate-600 w-24">
                      Time
                    </th>
                    {DAYS.map((d, idx) => (
                      <th
                        key={d}
                        className={`text-center px-3 py-3 text-xs font-semibold ${
                          idx === todayIndex ? "text-sky-600 bg-sky-50/50" : "text-slate-600"
                        }`}
                      >
                        {d}
                        {idx === todayIndex && (
                          <span className="block text-[10px] font-normal text-sky-500">
                            Today
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-slate-900">
                          {item.medication?.name || "Medication"}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.compartment_number === 1
                                ? "bg-red-500"
                                : item.compartment_number === 2
                                ? "bg-emerald-500"
                                : "bg-slate-400 border border-slate-500"
                            }`}
                          />
                          <span>
                            Compartment {item.compartment_number} (
                            {item.compartment_number === 1
                              ? "Red LED"
                              : item.compartment_number === 2
                              ? "Green LED"
                              : "White LED"}
                            )
                          </span>
                          {item.medication?.dosage ? ` · ${item.medication.dosage}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {formatTime(item.scheduled_time)}
                      </td>
                      {DAYS.map((_, di) => {
                        const activeOnDay = item.days_of_week.includes(di);
                        return (
                          <td
                            key={di}
                            className={`text-center px-3 py-3.5 ${
                              di === todayIndex ? "bg-sky-50/20" : ""
                            }`}
                          >
                            {activeOnDay ? (
                              <span className="inline-block w-6 h-6 rounded-full bg-sky-100 border-2 border-sky-500 text-sky-700 text-xs font-bold leading-5">
                                ✓
                              </span>
                            ) : (
                              <span className="inline-block w-2 h-2 rounded-full bg-slate-200" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Today's timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-800">
                Today&apos;s Chronological Timeline
              </h2>
              <span className="text-xs bg-sky-50 text-sky-700 font-medium px-2.5 py-1 rounded-full">
                {DAYS[todayIndex]}{todayDateString ? `, ${todayDateString}` : ""}
              </span>
            </div>

            {todaySchedules.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">
                No doses scheduled for today!
              </p>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {todaySchedules.map((item) => (
                  <div key={item.id} className="relative flex items-center gap-4">
                    <div className="absolute -left-6 w-4 h-4 rounded-full bg-sky-500 border-2 border-white ring-2 ring-sky-200" />
                    <div className="flex-1 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xs font-bold">
                          C{item.compartment_number}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.medication?.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.medication?.dosage || "Dose"} · {item.medication?.instructions || "Take with water"}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-sky-700 bg-sky-100/60 px-3 py-1 rounded-lg">
                        {formatTime(item.scheduled_time)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
