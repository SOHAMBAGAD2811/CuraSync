"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface Medicine {
  name: string;
  dosage?: string;
  instructions?: string;
  compartment?: number;
}

interface Interaction {
  type: string;
  severity: "low" | "moderate" | "high" | "critical";
  medicines: string[];
  description: string;
  recommendation: string;
}

interface TimingConflict {
  bay1: number;
  bay2: number;
  suggestedDelay: string;
  reason: string;
}

interface InteractionData {
  safe: boolean;
  overallRisk: "safe" | "low" | "moderate" | "high" | "critical";
  interactions: Interaction[];
  generalAdvice: string;
  timingConflicts: TimingConflict[];
}

interface Props {
  medicines: Medicine[];
}

const SEVERITY_CONFIG = {
  low: {
    color: "text-yellow-700 bg-yellow-50 border-yellow-200",
    icon: AlertTriangle,
    iconColor: "text-yellow-500",
    badge: "bg-yellow-100 text-yellow-800",
  },
  moderate: {
    color: "text-orange-700 bg-orange-50 border-orange-200",
    icon: AlertTriangle,
    iconColor: "text-orange-500",
    badge: "bg-orange-100 text-orange-800",
  },
  high: {
    color: "text-red-700 bg-red-50 border-red-200",
    icon: ShieldAlert,
    iconColor: "text-red-500",
    badge: "bg-red-100 text-red-800",
  },
  critical: {
    color: "text-red-900 bg-red-100 border-red-300",
    icon: ShieldX,
    iconColor: "text-red-700",
    badge: "bg-red-200 text-red-900 font-bold",
  },
};

const RISK_SHIELD = {
  safe: { icon: ShieldCheck, color: "text-emerald-500", bg: "bg-emerald-50 border-emerald-200", label: "All Safe" },
  low: { icon: Shield, color: "text-yellow-500", bg: "bg-yellow-50 border-yellow-200", label: "Low Risk" },
  moderate: { icon: ShieldAlert, color: "text-orange-500", bg: "bg-orange-50 border-orange-200", label: "Moderate Risk" },
  high: { icon: ShieldAlert, color: "text-red-500", bg: "bg-red-50 border-red-200", label: "High Risk" },
  critical: { icon: ShieldX, color: "text-red-700", bg: "bg-red-100 border-red-300", label: "Critical Risk" },
};

export function DrugInteractionShield({ medicines }: Props) {
  const [data, setData] = useState<InteractionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lastCheckedMeds, setLastCheckedMeds] = useState<string>("");

  const checkInteractions = useCallback(async () => {
    if (medicines.length < 2) {
      setData(null);
      return;
    }

    const medKey = medicines.map((m) => `${m.name}:${m.dosage}`).join("|");
    if (medKey === lastCheckedMeds) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai/drug-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicines }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
        setLastCheckedMeds(medKey);
        // Auto-expand if there are interactions
        if (!result.data.safe && result.data.interactions?.length > 0) {
          setExpanded(true);
        }
      }
    } catch {}
    setLoading(false);
  }, [medicines, lastCheckedMeds]);

  useEffect(() => {
    if (medicines.length >= 2) {
      const timer = setTimeout(checkInteractions, 500);
      return () => clearTimeout(timer);
    }
  }, [medicines, checkInteractions]);

  if (medicines.length < 2) return null;

  const riskConfig = data ? RISK_SHIELD[data.overallRisk] || RISK_SHIELD.safe : RISK_SHIELD.safe;
  const RiskIcon = riskConfig.icon;

  return (
    <div
      id="drug-interaction-shield"
      className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
        data && !data.safe
          ? "border-orange-200 bg-gradient-to-br from-orange-50 to-red-50"
          : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50"
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            loading ? "bg-slate-100" : data && !data.safe ? "bg-orange-100" : "bg-emerald-100"
          }`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          ) : (
            <RiskIcon className={`w-5 h-5 ${riskConfig.color}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              AI Drug Safety Shield
            </h3>
            <span className="flex items-center gap-1 text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">
              <Sparkles className="w-2.5 h-2.5" />
              Gemini
            </span>
          </div>
          {loading ? (
            <p className="text-xs text-slate-500 mt-0.5">Analyzing {medicines.length} medications...</p>
          ) : data ? (
            <p className={`text-xs font-semibold mt-0.5 ${riskConfig.color.split(" ").find((c) => c.startsWith("text-"))}`}>
              {data.overallRisk === "safe" || data.safe
                ? `✓ No interactions detected across ${medicines.length} medications`
                : `${data.interactions.length} interaction${data.interactions.length !== 1 ? "s" : ""} found · ${riskConfig.label}`}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">
              Checking {medicines.length} medications for interactions...
            </p>
          )}
        </div>

        {data && data.interactions.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-white/60 transition-colors text-slate-500 flex-shrink-0 cursor-pointer"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}

        {!loading && medicines.length >= 2 && (
          <button
            onClick={() => { setLastCheckedMeds(""); checkInteractions(); }}
            className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-white/60 transition-colors flex-shrink-0 cursor-pointer"
          >
            Re-check
          </button>
        )}
      </div>

      {/* General Advice */}
      {data?.generalAdvice && (
        <div className="px-4 pb-3">
          <p className="text-xs text-slate-600 leading-relaxed italic">
            💊 {data.generalAdvice}
          </p>
        </div>
      )}

      {/* Expanded Interactions */}
      {expanded && data && data.interactions.length > 0 && (
        <div className="border-t border-white/60 px-4 py-3 space-y-2.5">
          {data.interactions.map((interaction, i) => {
            const sev = SEVERITY_CONFIG[interaction.severity] || SEVERITY_CONFIG.low;
            const SevIcon = sev.icon;
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 ${sev.color}`}
              >
                <div className="flex items-start gap-2">
                  <SevIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${sev.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${sev.badge}`}>
                        {interaction.severity}
                      </span>
                      <span className="text-xs font-semibold">{interaction.medicines.join(" ↔ ")}</span>
                    </div>
                    <p className="text-xs mt-1 leading-relaxed">{interaction.description}</p>
                    <div className="mt-1.5 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5 text-current opacity-70" />
                      <p className="text-xs font-semibold">{interaction.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {data.timingConflicts && data.timingConflicts.length > 0 && (
            <div className="mt-1 space-y-1.5">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Timing Conflicts
              </p>
              {data.timingConflicts.map((tc, i) => (
                <div
                  key={i}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800"
                >
                  <span className="font-semibold">Bay {tc.bay1} & Bay {tc.bay2}</span>
                  {" — "}Suggested delay: <span className="font-bold">{tc.suggestedDelay}</span>
                  <span className="text-amber-600"> · {tc.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
