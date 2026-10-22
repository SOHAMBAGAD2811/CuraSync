"use client";

import { useEffect, useState, useCallback } from "react";
import { AdherenceChart, type DayAdherence } from "@/components/dashboard/AdherenceChart";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Database } from "@/lib/types/database";
import { AdherenceInsights } from "@/components/ai/AdherenceInsights";

type DoseOccurrence = Database["public"]["Tables"]["dose_occurrences"]["Row"];
type Schedule = Database["public"]["Tables"]["medication_schedules"]["Row"];
type Medication = Database["public"]["Tables"]["medications"]["Row"];

interface DoseWithMed extends DoseOccurrence {
  schedule?: Schedule & {
    medication?: Medication;
  };
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<DayAdherence[]>([]);
  const [takenTotal, setTakenTotal] = useState(0);
  const [lateTotal, setLateTotal] = useState(0);
  const [missedTotal, setMissedTotal] = useState(0);
  const [adherencePct, setAdherencePct] = useState(100);
  const [issueDoses, setIssueDoses] = useState<DoseWithMed[]>([]);

  const supabase = createClient();

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get doses for past 7 days
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("dose_occurrences")
        .select("*, medication_schedules(*, medications(*))")
        .eq("patient_id", user.id)
        .gte("due_at", sevenDaysAgo.toISOString())
        .order("due_at", { ascending: false });

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Initialize map for the last 7 calendar days
      const dailyBuckets: { [key: string]: { taken: number; late: number; missed: number } } = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayLabel = days[d.getDay()];
        dailyBuckets[dayLabel] = { taken: 0, late: 0, missed: 0 };
      }

      let takenCount = 0;
      let lateCount = 0;
      let missedCount = 0;
      const issues: DoseWithMed[] = [];

      for (const item of data) {
        const itemDate = new Date(item.due_at);
        const dayLabel = days[itemDate.getDay()];

        if (item.status === "acknowledged") {
          takenCount++;
          if (dailyBuckets[dayLabel]) dailyBuckets[dayLabel].taken++;
        } else if (item.status === "late") {
          lateCount++;
          if (dailyBuckets[dayLabel]) dailyBuckets[dayLabel].late++;
          issues.push({
            ...item,
            schedule: item.medication_schedules as unknown as (Schedule & { medication: Medication }),
          });
        } else if (item.status === "missed") {
          missedCount++;
          if (dailyBuckets[dayLabel]) dailyBuckets[dayLabel].missed++;
          issues.push({
            ...item,
            schedule: item.medication_schedules as unknown as (Schedule & { medication: Medication }),
          });
        }
      }

      const totalRecorded = takenCount + lateCount + missedCount;
      const pct = totalRecorded > 0 ? Math.round(((takenCount + lateCount) / totalRecorded) * 100) : 100;

      setTakenTotal(takenCount);
      setLateTotal(lateCount);
      setMissedTotal(missedCount);
      setAdherencePct(pct);
      setIssueDoses(issues);

      const chartArr: DayAdherence[] = Object.keys(dailyBuckets).map((k) => ({
        day: k,
        taken: dailyBuckets[k].taken,
        late: dailyBuckets[k].late,
        missed: dailyBuckets[k].missed,
      }));
      setChartData(chartArr);
    } catch (e) {
      console.error("Reports error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Weekly medication adherence, punctuality metrics, and missed dose logs
        </p>
      </div>

      {/* AI Predictive Adherence Insights */}
      <AdherenceInsights />

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-700">{takenTotal}</p>
              <p className="text-xs text-slate-500 font-medium">Taken On-Time</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
              <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-700">{lateTotal}</p>
              <p className="text-xs text-slate-500 font-medium">Taken Late</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-xs">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-600">{missedTotal}</p>
              <p className="text-xs text-slate-500 font-medium">Missed Doses</p>
            </div>
          </div>

          {/* Adherence % + Recharts Bar Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">
                  7-Day Adherence Rate
                </h2>
                <p className="text-xs text-slate-500">
                  Percentage of scheduled doses consumed
                </p>
              </div>
              <span className="text-3xl font-extrabold text-sky-600">
                {adherencePct}%
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  adherencePct >= 80
                    ? "bg-emerald-500"
                    : adherencePct >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${adherencePct}%` }}
              />
            </div>

            <div className="pt-2">
              <AdherenceChart data={chartData} />
            </div>
          </div>

          {/* Missed / late detail list */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Missed & Late Dose Details
            </h2>
            {issueDoses.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No missed or late doses in the last 7 days! Great adherence 🌟
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {issueDoses.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {d.schedule?.medication?.name || "Medication"}
                        {d.schedule?.medication?.dosage ? ` (${d.schedule.medication.dosage})` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        Due: {new Date(d.due_at).toLocaleDateString("en-IN", {
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · Compartment {d.schedule?.compartment_number || 1}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        d.status === "missed"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {d.status === "missed" ? "Missed" : "Late"}
                    </span>
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
