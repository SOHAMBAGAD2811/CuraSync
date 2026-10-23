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
  RefreshCw,
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
    color: "text-amber-800 bg-amber-50 border-amber-200",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-800",
  },
  moderate: {
    color: "text-orange-800 bg-orange-50 border-orange-200",
    icon: AlertTriangle,
    iconColor: "text-orange-600",
    badge: "bg-orange-100 text-orange-800",
  },
  high: {
    color: "text-red-800 bg-red-50 border-red-200",
    icon: ShieldAlert,
    iconColor: "text-red-600",
    badge: "bg-red-100 text-red-800",
  },
  critical: {
    color: "text-red-950 bg-red-100/80 border-red-300",
    icon: ShieldX,
    iconColor: "text-red-700",
    badge: "bg-red-200 text-red-900 font-bold",
  },
};

const RISK_SHIELD = {
  safe: {
    icon: ShieldCheck,
    color: "text-emerald-600",
    bg: "border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-sky-50/50",
    label: "All Clear — Safe Combination",
  },
  low: {
    icon: Shield,
    color: "text-amber-600",
    bg: "border-amber-200 bg-gradient-to-br from-amber-50/80 to-yellow-50/50",
    label: "Low Risk Interaction",
  },
  moderate: {
    icon: ShieldAlert,
    color: "text-orange-600",
    bg: "border-orange-200 bg-gradient-to-br from-orange-50/80 to-amber-50/50",
    label: "Moderate Interaction Risk",
  },
  high: {
    icon: ShieldAlert,
    color: "text-red-600",
    bg: "border-red-200 bg-gradient-to-br from-red-50/80 to-orange-50/50",
    label: "High Risk Interaction",
  },
  critical: {
    icon: ShieldX,
    color: "text-red-700",
    bg: "border-red-300 bg-gradient-to-br from-red-100/90 to-red-50/80",
    label: "Critical Contraindication",
  },
};

const READY_CONFIG = {
  icon: Shield,
  color: "text-sky-700",
  bg: "border-sky-200/80 bg-gradient-to-br from-sky-50/60 to-slate-50/70",
  label: "Interaction Check Ready",
};

export function DrugInteractionShield({ medicines }: Props) {
  const [data, setData] = useState<InteractionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);

  const checkInteractions = useCallback(async () => {
    if (medicines.length < 2) {
      setData(null);
      setRateLimitError(null);
      return;
    }

    setLoading(true);
    setRateLimitError(null);
    try {
      const res = await fetch("/api/ai/drug-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medicines }),
      });
      const result = await res.json();
      if (res.status === 429) {
        setRateLimitError(result.error || "Rate limit reached. Please wait a moment.");
        setLoading(false);
        return;
      }
      if (result.success && result.data) {
        setData(result.data);
        // Auto-expand if there are interactions
        if (!result.data.safe && result.data.interactions?.length > 0) {
          setExpanded(true);
        }
      }
    } catch {}
    setLoading(false);
  }, [medicines]);

  if (medicines.length < 2) return null;

  const riskConfig = data ? RISK_SHIELD[data.overallRisk] || RISK_SHIELD.safe : READY_CONFIG;
  const RiskIcon = riskConfig.icon;

  return (
    <div
      id="drug-interaction-shield"
      className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-xs ${riskConfig.bg}`}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            loading
              ? "bg-sky-100 text-sky-600"
              : data && !data.safe
              ? "bg-amber-100 text-amber-700"
              : data && data.safe
              ? "bg-emerald-100 text-emerald-700"
              : "bg-sky-100 text-sky-700"
          }`}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />
          ) : (
            <RiskIcon className={`w-5 h-5 ${riskConfig.color}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              AI Drug Safety Shield
            </h3>
            <span className="flex items-center gap-1 text-[10px] font-semibold bg-sky-100 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-full">
              <Sparkles className="w-2.5 h-2.5" />
              Gemini AI
            </span>
          </div>
          {rateLimitError ? (
            <p className="text-xs font-semibold text-amber-700 mt-0.5">
              ⏳ {rateLimitError}
            </p>
          ) : loading ? (
            <p className="text-xs text-slate-500 mt-0.5">Analyzing {medicines.length} medications with Gemini AI...</p>
          ) : data ? (
            <p className={`text-xs font-semibold mt-0.5 ${riskConfig.color}`}>
              {data.overallRisk === "safe" || data.safe
                ? `✓ No harmful interactions detected across all ${medicines.length} medications`
                : `${data.interactions.length} interaction${data.interactions.length !== 1 ? "s" : ""} found · ${riskConfig.label}`}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-drug interaction analysis ready for {medicines.length} active prescriptions.
            </p>
          )}
        </div>

        {!data && !loading && (
          <button
            type="button"
            onClick={checkInteractions}
            id="run-drug-interaction-check"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-all flex-shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Check Interactions</span>
          </button>
        )}

        {data && !loading && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {data.interactions && data.interactions.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-white/80 transition-colors text-slate-500 hover:text-slate-800 cursor-pointer"
                title={expanded ? "Collapse details" : "Expand details"}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={checkInteractions}
              id="recheck-drug-interactions"
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-sky-700 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-white/80 hover:bg-white transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Re-check</span>
            </button>
          </div>
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
        <div className="border-t border-slate-200/60 px-4 py-3 space-y-2.5 bg-white/50 backdrop-blur-2xs">
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
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-current opacity-70" />
                      <p className="text-xs font-semibold">{interaction.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {data.timingConflicts && data.timingConflicts.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                Timing Conflicts & Bay Spacing
              </p>
              {data.timingConflicts.map((tc, i) => (
                <div
                  key={i}
                  className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 text-xs text-amber-900"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <span>Bay {tc.bay1} & Bay {tc.bay2}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-amber-800">Suggested interval: <strong className="text-amber-900">{tc.suggestedDelay}</strong></span>
                  </div>
                  <p className="text-amber-700 mt-1">{tc.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
