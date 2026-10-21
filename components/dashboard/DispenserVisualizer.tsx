"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Package,
  Radio,
  Check,
  RotateCw,
} from "lucide-react";
import type { Database, CompartmentNumber } from "@/lib/types/database";
import { Dispenser3DCanvas } from "@/components/dashboard/Dispenser3DCanvas";

type DoseOccurrence = Database["public"]["Tables"]["dose_occurrences"]["Row"];
type Schedule = Database["public"]["Tables"]["medication_schedules"]["Row"];
type Medication = Database["public"]["Tables"]["medications"]["Row"];

export interface FullDose extends DoseOccurrence {
  schedule?: Schedule & {
    medication?: Medication;
  };
}

export interface CompartmentDetail {
  compNum: CompartmentNumber;
  medName: string | null;
  dosage: string | null;
  instructions: string | null;
  scheduledTime: string | null;
  hasPendingDose: boolean;
  hasTakenToday: boolean;
  activeDoseId: string | null;
}

interface DispenserVisualizerProps {
  deviceOnline: boolean;
  lastHeartbeat: string | null;
  deviceKey?: string | null;
  doses: FullDose[];
  compartmentDetails: Record<number, CompartmentDetail>;
  onTriggerLidOpen: (compNum: CompartmentNumber) => Promise<void>;
  isSimulating: boolean;
}

export function DispenserVisualizer({
  deviceOnline,
  lastHeartbeat,
  deviceKey,
  doses,
  compartmentDetails,
  onTriggerLidOpen,
  isSimulating,
}: DispenserVisualizerProps) {
  // RTC live ticking clock for the simulated 1602 LCD
  const [rtcTime, setRtcTime] = useState<string>("00:00:00");
  const [activeCompOpening, setActiveCompOpening] = useState<number | null>(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setRtcTime(now.toTimeString().split(" ")[0]);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Determine if any compartment is currently pending
  const pendingCompartment = [1, 2, 3].find(
    (c) => compartmentDetails[c]?.hasPendingDose
  ) as CompartmentNumber | undefined;

  const buzzerActive = Boolean(pendingCompartment);

  const handleLidClick = async (compNum: CompartmentNumber) => {
    setActiveCompOpening(compNum);
    await onTriggerLidOpen(compNum);
    setTimeout(() => {
      setActiveCompOpening(null);
    }, 1800);
  };

  const COMPARTMENT_HARDWARE: Record<
    number,
    {
      ledColorName: string;
      ledPin: string;
      reedPin: string;
      ledActiveDot: string;
      ledIdleDot: string;
      badgeStyle: string;
      cardBg: string;
      cardBorder: string;
      textAccent: string;
    }
  > = {
    1: {
      ledColorName: "Red LED",
      ledPin: "GPIO 18",
      reedPin: "GPIO 32",
      ledActiveDot: "bg-red-500 animate-led-red",
      ledIdleDot: "bg-red-300",
      badgeStyle: "bg-red-50 text-red-700 border-red-200",
      cardBg: "bg-gradient-to-br from-white to-red-50/30",
      cardBorder: "border-red-200/80",
      textAccent: "text-red-600",
    },
    2: {
      ledColorName: "Green LED",
      ledPin: "GPIO 19",
      reedPin: "GPIO 33",
      ledActiveDot: "bg-emerald-500 animate-led-green",
      ledIdleDot: "bg-emerald-300",
      badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
      cardBg: "bg-gradient-to-br from-white to-emerald-50/30",
      cardBorder: "border-emerald-200/80",
      textAccent: "text-emerald-600",
    },
    3: {
      ledColorName: "White LED",
      ledPin: "GPIO 23",
      reedPin: "GPIO 25",
      ledActiveDot: "bg-white border-2 border-slate-300 animate-led-white",
      ledIdleDot: "bg-slate-200 border border-slate-400",
      badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
      cardBg: "bg-gradient-to-br from-white to-slate-50/50",
      cardBorder: "border-slate-200",
      textAccent: "text-slate-700",
    },
  };

  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50/50 via-teal-50/30 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0 border border-sky-200">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Interactive 3D Hardware Dispenser
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                ESP32 IoT
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live WebGL 3D representation &bull; Reed switch lid detection &bull; Multi-color LEDs
            </p>
          </div>
        </div>

        {/* Real-time Hardware Indicators */}
        <div className="flex items-center gap-2 text-xs">
          {/* Wi-Fi Heartbeat */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border ${
              deviceOnline
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            {deviceOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>ESP32 Synced</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                <span>ESP32 Offline</span>
              </>
            )}
          </div>

          {/* Buzzer Indicator */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border ${
              buzzerActive
                ? "bg-amber-50 border-amber-300 text-amber-800 animate-pulse"
                : "bg-slate-50 border-slate-200 text-slate-500"
            }`}
          >
            {buzzerActive ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Buzzer Active</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span>Buzzer Idle</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Real 3D Hardware Canvas Model */}
        <div className="relative rounded-2xl bg-gradient-to-b from-sky-50/40 via-teal-50/20 to-white border border-sky-100/80 overflow-hidden shadow-inner flex flex-col items-center justify-center">
          <Dispenser3DCanvas
            pendingCompartment={pendingCompartment || null}
            activeOpening={activeCompOpening}
            onLidClick={(compNum) => handleLidClick(compNum)}
          />

          {/* 1602 LCD Emulation bar at bottom of 3D frame */}
          <div className="w-full px-4 py-2.5 bg-emerald-950 border-t border-emerald-900/60 font-mono text-emerald-300 text-xs flex flex-col sm:flex-row items-center justify-between gap-1 shadow-inner">
            <span className="font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              1602 LCD (0x27): [RTC {rtcTime}]
            </span>
            <span className="text-emerald-200 font-semibold tracking-wide text-center sm:text-right">
              {pendingCompartment ? (
                <span className="text-amber-300 animate-pulse">
                  &gt; COMPARTMENT {pendingCompartment} DOSE DUE! OPEN LID NOW
                </span>
              ) : doses.length > 0 && !doses.some((d) => d.status === "scheduled") ? (
                <span>&gt; ALL DOSES COMPLETED &bull; ALL CLEAR</span>
              ) : (
                <span>&gt; CuraSync ESP32 Ready &bull; Standby</span>
              )}
            </span>
          </div>
        </div>

        {/* 3 Compartment Control Bays */}
        <div>
          <div className="flex items-center justify-between mb-3 text-xs text-slate-600 font-semibold">
            <span className="uppercase tracking-wider text-[11px] text-slate-500">
              Hardware Compartment Bays
            </span>
            <span>Click any bay or 3D lid to trigger reed switch sensor</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((num) => {
              const compNum = num as CompartmentNumber;
              const hw = COMPARTMENT_HARDWARE[compNum];
              const detail = compartmentDetails[compNum];
              const isPending = detail?.hasPendingDose;
              const isTaken = detail?.hasTakenToday;
              const isConfigured = Boolean(detail?.medName);
              const isLidOpening = activeCompOpening === compNum;

              return (
                <div
                  key={compNum}
                  className={`relative rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 border ${
                    hw.cardBg
                  } ${
                    isPending
                      ? "border-amber-400 shadow-md ring-2 ring-amber-400/20"
                      : `${hw.cardBorder} hover:shadow-xs`
                  }`}
                >
                  {/* Top: Compartment number & LED Diode */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-500">
                        Bay #{compNum}
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900">
                        Compartment {compNum}
                      </h4>
                    </div>

                    {/* LED Diode Indicator */}
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-3 h-3 rounded-full inline-block transition-all ${
                            isPending ? hw.ledActiveDot : hw.ledIdleDot
                          }`}
                        />
                        <span
                          className={`text-xs font-bold ${
                            isPending ? hw.textAccent : "text-slate-500"
                          }`}
                        >
                          {isPending ? "LED ON" : "LED OFF"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {hw.ledColorName} &bull; {hw.ledPin}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Medication assigned */}
                  <div className="my-2 p-3 rounded-xl bg-white/90 border border-slate-200/80 shadow-2xs">
                    {isConfigured ? (
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {detail.medName}
                          </p>
                          {detail.dosage && (
                            <span className="text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100 font-semibold flex-shrink-0">
                              {detail.dosage}
                            </span>
                          )}
                        </div>

                        {detail.instructions && (
                          <p className="text-[11px] text-slate-500 truncate">
                            {detail.instructions}
                          </p>
                        )}

                        <div className="pt-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium">
                            {detail.scheduledTime ? `Time: ${detail.scheduledTime}` : "Daily"}
                          </span>

                          {isPending ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                              Due Now
                            </span>
                          ) : isTaken ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Taken
                            </span>
                          ) : (
                            <span className="text-slate-500">Scheduled</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center text-xs text-slate-400">
                        <Package className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                        No medication assigned
                      </div>
                    )}
                  </div>

                  {/* Bottom: Reed Switch & Lid Action */}
                  <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isLidOpening ? "bg-amber-500 animate-ping" : "bg-slate-400"
                        }`}
                      />
                      <span>{isLidOpening ? "Lid Opened!" : "Lid Closed"}</span>
                    </div>

                    <button
                      onClick={() => handleLidClick(compNum)}
                      disabled={isSimulating || isLidOpening}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      title={`Simulate reed switch on ${hw.reedPin}`}
                    >
                      <Radio className="w-3 h-3 text-sky-600" />
                      <span>{isLidOpening ? "Triggering..." : "Simulate Lid Open"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostic Pinout Footnote */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">ESP32 Pinout:</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> C1: GPIO 18 (Red LED) &bull; GPIO 32 (Reed)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> C2: GPIO 19 (Green LED) &bull; GPIO 33 (Reed)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-300 border border-slate-400 inline-block" /> C3: GPIO 23 (White LED) &bull; GPIO 25 (Reed)
            </span>
            <span>Buzzer: GPIO 26</span>
          </div>

          {lastHeartbeat && (
            <span className="text-slate-400">
              Last Ping: {new Date(lastHeartbeat).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
