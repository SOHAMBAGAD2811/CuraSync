"use client";

import { useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Pill,
  Sparkles,
  ChevronRight,
  Flame,
} from "lucide-react";
import type { Database } from "@/lib/types/database";

type DoseOccurrence = Database["public"]["Tables"]["dose_occurrences"]["Row"];
type Schedule = Database["public"]["Tables"]["medication_schedules"]["Row"];
type Medication = Database["public"]["Tables"]["medications"]["Row"];

export interface FullDose extends DoseOccurrence {
  schedule?: Schedule & {
    medication?: Medication;
  };
}

interface NextDoseHeroProps {
  doses: FullDose[];
  onMarkTaken: (doseId: string) => Promise<void>;
  markingId: string | null;
}

export function NextDoseHero({
  doses,
  onMarkTaken,
  markingId,
}: NextDoseHeroProps) {
  // Find next pending or scheduled dose
  const nextDose = useMemo(() => {
    // Prioritize pending (overdue/due now) first, then upcoming scheduled
    const pending = doses.find((d) => d.status === "pending");
    if (pending) return pending;
    return doses.find((d) => d.status === "scheduled");
  }, [doses]);

  const allTaken = doses.length > 0 && !nextDose;
  const noDosesConfigured = doses.length === 0;

  // LED Info mapping based on compartment
  const getLedConfig = (compartmentNumber: number = 1) => {
    switch (compartmentNumber) {
      case 1:
        return {
          colorName: "Red",
          badgeBg: "bg-red-500/15 border-red-500/30 text-red-200",
          dotClass: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)] animate-led-red",
          borderHover: "border-red-500/50",
          textAccent: "text-red-300",
          pin: "GPIO 18",
        };
      case 2:
        return {
          colorName: "Green",
          badgeBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200",
          dotClass: "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)] animate-led-green",
          borderHover: "border-emerald-500/50",
          textAccent: "text-emerald-300",
          pin: "GPIO 19",
        };
      case 3:
      default:
        return {
          colorName: "White",
          badgeBg: "bg-white/20 border-white/40 text-slate-100",
          dotClass: "bg-white shadow-[0_0_14px_rgba(255,255,255,1)] animate-led-white",
          borderHover: "border-white/60",
          textAccent: "text-white",
          pin: "GPIO 23",
        };
    }
  };

  const formatDueTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  const getRelativeDueNotice = (dueAtIso: string, isPending: boolean) => {
    const diffMin = Math.round((new Date(dueAtIso).getTime() - Date.now()) / 60000);
    if (isPending || diffMin <= 0) {
      return {
        text: "Due right now! Look for glowing LED on dispenser",
        isNow: true,
      };
    }
    if (diffMin < 60) {
      return {
        text: `Due in ${diffMin} minute${diffMin === 1 ? "" : "s"}`,
        isNow: false,
      };
    }
    const hours = Math.round(diffMin / 60);
    return {
      text: `Due in ~${hours} hour${hours === 1 ? "" : "s"}`,
      isNow: false,
    };
  };

  // State 1: All Doses Done Today!
  if (allTaken) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 md:p-8 text-white shadow-xl shadow-emerald-950/20 border border-emerald-500/20">
        <div className="absolute -right-10 -bottom-10 w-56 h-56 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center flex-shrink-0 border border-white/20 shadow-inner">
              <Sparkles className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/30 border border-emerald-400/40 text-emerald-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  All Caught Up!
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  <Flame className="w-3 h-3 text-amber-300" /> Great streak
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                All daily medications completed
              </h2>
              <p className="text-sm text-emerald-100/80 mt-1 max-w-xl">
                Your dispenser LEDs are in idle standby. Great job sticking to
                your health regimen today!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: No Doses Configured
  if (noDosesConfigured) {
    return (
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">No doses scheduled today</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure your prescriptions and compartment schedules in the Medicines tab.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // State 3: Active Next Dose
  const compNum = nextDose?.schedule?.compartment_number || 1;
  const led = getLedConfig(compNum);
  const isPending = nextDose?.status === "pending";
  const dueInfo = getRelativeDueNotice(nextDose!.due_at, isPending);
  const medName = nextDose?.schedule?.medication?.name || "Medication";
  const dosage = nextDose?.schedule?.medication?.dosage;
  const instructions = nextDose?.schedule?.medication?.instructions;
  const isRecording = markingId === nextDose?.id;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-6 md:p-8 text-white shadow-2xl shadow-sky-950/30 border border-sky-500/20">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left Column: Pill & Hardware Cues */}
        <div className="space-y-4">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md ${
                isPending
                  ? "bg-amber-500/20 border-amber-400/40 text-amber-200"
                  : "bg-sky-500/20 border-sky-400/30 text-sky-200"
              }`}
            >
              {isPending ? (
                <AlertCircle className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-sky-300" />
              )}
              {isPending ? "Dose Due Now" : "Next Scheduled Dose"}
            </span>

            {/* Hardware Dispenser & LED Indicator */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-md ${led.badgeBg}`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full inline-block ${led.dotClass}`}
              />
              <span>
                Compartment {compNum} • <strong>{led.colorName} LED</strong>
              </span>
            </div>

            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Hardware ({led.pin})
            </span>
          </div>

          {/* Main Title & Dosage */}
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {medName}
              </h2>
              {dosage && (
                <span className="text-lg font-medium text-sky-300 bg-sky-950/60 px-2.5 py-0.5 rounded-lg border border-sky-500/30">
                  {dosage}
                </span>
              )}
            </div>

            {/* Due Time + Countdown */}
            <p className="text-sm sm:text-base font-medium text-slate-300 mt-1 flex items-center gap-2">
              <span>Scheduled for <strong>{formatDueTime(nextDose!.due_at)}</strong></span>
              <span className="text-slate-500">•</span>
              <span className={dueInfo.isNow ? "text-amber-300 font-semibold" : "text-sky-300"}>
                {dueInfo.text}
              </span>
            </p>
          </div>

          {/* Patient Instructions Pill */}
          {instructions && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 max-w-lg">
              <span className="text-sm">💡</span>
              <span className="truncate">
                <strong>Instruction:</strong> {instructions}
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Prominent Take Action Card */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-center gap-3">
          <button
            onClick={() => onMarkTaken(nextDose!.id)}
            disabled={isRecording}
            className="group relative inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all duration-200 shadow-xl disabled:opacity-60 overflow-hidden cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/25 active:scale-[0.98]"
          >
            {isRecording ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Acknowledging...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-slate-950 transition-transform group-hover:scale-110" />
                <span>Mark Dose Taken</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center lg:text-right text-slate-400 max-w-xs">
            Or open <strong>Compartment {compNum}</strong> on the physical unit to auto-acknowledge via reed switch.
          </p>
        </div>
      </div>
    </div>
  );
}
