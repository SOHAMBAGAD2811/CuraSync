"use client";

import { useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Pill,
  Sparkles,
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
          badgeBg: "bg-red-50 border-red-200 text-red-800",
          dotClass: "bg-red-500 animate-led-red",
          borderHover: "border-red-400",
          textAccent: "text-red-700",
          pin: "GPIO 18",
        };
      case 2:
        return {
          colorName: "Green",
          badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-800",
          dotClass: "bg-emerald-500 animate-led-green",
          borderHover: "border-emerald-400",
          textAccent: "text-emerald-700",
          pin: "GPIO 19",
        };
      case 3:
      default:
        return {
          colorName: "White",
          badgeBg: "bg-slate-100 border-slate-300 text-slate-800",
          dotClass: "bg-white border-2 border-slate-300 animate-led-white",
          borderHover: "border-slate-400",
          textAccent: "text-slate-800",
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
        text: "Due right now! Check dispenser LED",
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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white p-6 sm:p-7 border border-emerald-200 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 border border-emerald-200">
              <Sparkles className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  All Caught Up!
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <Flame className="w-3.5 h-3.5 text-amber-600" /> Great streak
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                All daily medications completed
              </h2>
              <p className="text-sm text-slate-600 mt-0.5">
                Your dispenser LEDs are in idle standby. Great job sticking to your health routine today!
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
      <div className="rounded-3xl bg-white border border-slate-200 p-6 text-slate-900 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">No doses scheduled today</h3>
            <p className="text-xs text-slate-500 mt-0.5">
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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-sky-50/40 to-emerald-50/30 p-6 sm:p-7 border border-sky-200/90 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left Column: Pill & Hardware Cues */}
        <div className="space-y-3.5">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                isPending
                  ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                  : "bg-sky-100 text-sky-800 border-sky-200"
              }`}
            >
              {isPending ? (
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-sky-600" />
              )}
              {isPending ? "Dose Due Now" : "Next Scheduled Dose"}
            </span>

            {/* Hardware Dispenser & LED Indicator */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${led.badgeBg}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${led.dotClass}`} />
              <span>
                Compartment {compNum} &bull; <strong>{led.colorName} LED</strong>
              </span>
            </div>

            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Hardware ({led.pin})
            </span>
          </div>

          {/* Main Title & Dosage */}
          <div>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                {medName}
              </h2>
              {dosage && (
                <span className="text-base font-bold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-lg border border-sky-200">
                  {dosage}
                </span>
              )}
            </div>

            {/* Due Time + Countdown */}
            <p className="text-sm sm:text-base font-medium text-slate-600 mt-1 flex items-center gap-2">
              <span>Scheduled for <strong>{formatDueTime(nextDose!.due_at)}</strong></span>
              <span className="text-slate-400">&bull;</span>
              <span className={dueInfo.isNow ? "text-amber-700 font-bold" : "text-sky-700 font-semibold"}>
                {dueInfo.text}
              </span>
            </p>
          </div>

          {/* Patient Instructions */}
          {instructions && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 shadow-2xs max-w-lg">
              <span className="text-sm">💡</span>
              <span className="truncate">
                <strong>Instruction:</strong> {instructions}
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Prominent Take Action Card */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-center gap-2.5">
          <button
            onClick={() => onMarkTaken(nextDose!.id)}
            disabled={isRecording}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all duration-200 shadow-md disabled:opacity-60 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-600/20 active:scale-[0.98]"
          >
            {isRecording ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Recording...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-white" />
                <span>Mark Dose as Taken</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-center lg:text-right text-slate-500 max-w-xs">
            Or open <strong>Compartment {compNum}</strong> on the physical unit to auto-acknowledge via reed switch.
          </p>
        </div>
      </div>
    </div>
  );
}
