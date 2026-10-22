"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  TrendingUp,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart2,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronRight,
  Calendar,
  FileText,
} from "lucide-react";

interface Insight {
  type: "pattern" | "warning" | "recommendation";
  icon: string;
  title: string;
  description: string;
}

interface Recommendation {
  bay: number;
  currentTime: string;
  suggestedTime: string;
  reason: string;
}

interface AdherenceData {
  riskScore: number;
  riskLevel: "low" | "moderate" | "high";
  riskLabel: string;
  weeklyBrief: string;
  insights: Insight[];
  recommendations: Recommendation[];
  dayRisks: Record<string, number>;
}

interface Stats {
  totalDoses: number;
  takenDoses: number;
  missedDoses: number;
  lateDoses: number;
  adherenceRate: number;
  dayStats: Record<string, { total: number; taken: number; avgDelay: number }>;
  bayStats: Record<string, { total: number; taken: number; avgDelay: number }>;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const RISK_CONFIG = {
  low: {
    gradient: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    label: "Low Risk",
    ringColor: "#10b981",
  },
  moderate: {
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    label: "Moderate Risk",
    ringColor: "#f59e0b",
  },
  high: {
    gradient: "from-red-500 to-rose-600",
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    label: "High Risk",
    ringColor: "#ef4444",
  },
};

export function AdherenceInsights() {
  const { user } = useAuth();
  const [data, setData] = useState<AdherenceData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/adherence-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setStats(result.stats);
      } else {
        setError(result.error || "Failed to load insights");
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const riskLevel = data?.riskLevel || "low";
  const riskConfig = RISK_CONFIG[riskLevel];
  const adherenceRate = stats?.adherenceRate || data?.riskScore || 0;

  // Find highest risk day
  const highestRiskDay = data?.dayRisks
    ? Object.entries(data.dayRisks).sort(([, a], [, b]) => b - a)[0]
    : null;

  return (
    <div id="adherence-insights" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-white" style={{ width: "18px", height: "18px" }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Predictive Adherence AI
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" />
                Gemini
              </span>
            </h2>
            <p className="text-xs text-slate-500">Smart caregiver insights from 30-day adherence history</p>
          </div>
        </div>
        <button
          onClick={fetchInsights}
          disabled={loading}
          id="refresh-adherence-insights"
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
            <Brain className="w-6 h-6 text-violet-600 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-slate-600">Analyzing 30-day adherence patterns...</p>
          <p className="text-xs text-slate-400">Gemini AI is processing your medication history</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && stats && (
        <>
          {/* Risk Score Card */}
          <div className={`rounded-2xl border p-5 ${riskConfig.bg}`}>
            <div className="flex items-center gap-4">
              {/* Circular Progress */}
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="none"
                    stroke={riskConfig.ringColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`}
                    strokeDashoffset={`${2 * Math.PI * 32 * (1 - adherenceRate / 100)}`}
                    style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-slate-900">{adherenceRate}%</span>
                  <span className="text-[9px] text-slate-500 font-medium">adherence</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${riskConfig.text}`}>{riskConfig.label}</span>
                  {highestRiskDay && (
                    <span className="text-xs text-slate-500">
                      · {data.riskLabel}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <p className="text-base font-bold text-emerald-600">{stats.takenDoses}</p>
                    <p className="text-[10px] text-slate-500">Taken</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-amber-600">{stats.lateDoses}</p>
                    <p className="text-[10px] text-slate-500">Late</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-red-600">{stats.missedDoses}</p>
                    <p className="text-[10px] text-slate-500">Missed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Day of Week Risk Bars */}
            {data.dayRisks && Object.keys(data.dayRisks).length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Miss risk by day
                </p>
                <div className="grid grid-cols-7 gap-1">
                  {DAY_NAMES.map((day, i) => {
                    const risk = data.dayRisks[String(i)] || 0;
                    const isHighest = risk === Math.max(...Object.values(data.dayRisks));
                    return (
                      <div key={day} className="flex flex-col items-center gap-1">
                        <div className="w-full h-12 bg-white/60 rounded-lg flex items-end overflow-hidden border border-white/80">
                          <div
                            className={`w-full rounded-sm transition-all duration-700 ${
                              risk > 60
                                ? "bg-red-400"
                                : risk > 30
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                            } ${isHighest ? "opacity-100" : "opacity-80"}`}
                            style={{ height: `${Math.max(risk, 5)}%` }}
                          />
                        </div>
                        <span className={`text-[9px] font-bold ${isHighest ? riskConfig.text : "text-slate-500"}`}>
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Weekly Caregiver Brief */}
          {data.weeklyBrief && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <button
                onClick={() => setBriefExpanded((v) => !v)}
                className="w-full flex items-center gap-3 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-bold text-slate-900">Weekly Caregiver Brief</p>
                  {!briefExpanded && (
                    <p className="text-xs text-slate-500 truncate">{data.weeklyBrief}</p>
                  )}
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${briefExpanded ? "rotate-90" : ""}`}
                />
              </button>
              {briefExpanded && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-sm text-slate-700 leading-relaxed">{data.weeklyBrief}</p>
                </div>
              )}
            </div>
          )}

          {/* Bay Performance */}
          {stats.bayStats && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-slate-500" />
                Bay Performance (30 days)
              </h3>
              <div className="space-y-2.5">
                {[1, 2, 3].map((bay) => {
                  const bs = stats.bayStats[String(bay)];
                  if (!bs || bs.total === 0) return null;
                  const rate = Math.round((bs.taken / bs.total) * 100);
                  const ledColor =
                    bay === 1 ? "bg-red-500" : bay === 2 ? "bg-emerald-500" : "bg-slate-400 border border-slate-500";
                  return (
                    <div key={bay}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${ledColor}`} />
                          <span className="text-xs font-semibold text-slate-700">Bay {bay}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {bs.avgDelay > 0 && (
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              avg {bs.avgDelay}min delay
                            </span>
                          )}
                          <span
                            className={`text-xs font-bold ${
                              rate >= 80 ? "text-emerald-600" : rate >= 60 ? "text-amber-600" : "text-red-600"
                            }`}
                          >
                            {rate}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            rate >= 80
                              ? "bg-emerald-500"
                              : rate >= 60
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Insights */}
          {data.insights && data.insights.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                AI Insights
              </h3>
              <div className="space-y-2.5">
                {data.insights.map((insight, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 flex items-start gap-3 ${
                      insight.type === "warning"
                        ? "bg-amber-50 border border-amber-100"
                        : insight.type === "recommendation"
                        ? "bg-indigo-50 border border-indigo-100"
                        : "bg-slate-50 border border-slate-100"
                    }`}
                  >
                    <span className="text-base flex-shrink-0 mt-0.5">{insight.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{insight.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Schedule Recommendations
              </h3>
              <div className="space-y-2">
                {data.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800">Bay {rec.bay}</p>
                      <p className="text-xs text-slate-600">{rec.reason}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs line-through text-slate-400">{rec.currentTime}</p>
                      <p className="text-sm font-bold text-violet-700">{rec.suggestedTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
