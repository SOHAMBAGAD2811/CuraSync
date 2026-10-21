"use client";

import { useState, useEffect } from "react";
import {
  Cpu,
  Wifi,
  WifiOff,
  Bell,
  Volume2,
  VolumeX,
  Package,
  Layers,
  Sparkles,
  Check,
  Radio,
  ExternalLink,
} from "lucide-react";
import type { Database, CompartmentNumber } from "@/lib/types/database";

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
  );

  const buzzerActive = Boolean(pendingCompartment);

  const handleLidClick = async (compNum: CompartmentNumber) => {
    setActiveCompOpening(compNum);
    await onTriggerLidOpen(compNum);
    setTimeout(() => {
      setActiveCompOpening(null);
    }, 1200);
  };

  // Hardware config for the 3 compartments
  const COMPARTMENT_HARDWARE: Record<
    number,
    {
      ledColorName: string;
      ledPin: string;
      reedPin: string;
      ledActiveBg: string;
      ledActiveGlowClass: string;
      ledIdleBg: string;
      accentBorder: string;
      glowAccent: string;
      labelColor: string;
    }
  > = {
    1: {
      ledColorName: "Red LED",
      ledPin: "GPIO 18",
      reedPin: "GPIO 32",
      ledActiveBg: "bg-red-500",
      ledActiveGlowClass: "animate-led-red",
      ledIdleBg: "bg-red-950/70 border border-red-900/40",
      accentBorder: "border-red-500/30",
      glowAccent: "rgba(239, 68, 68, 0.15)",
      labelColor: "text-red-400",
    },
    2: {
      ledColorName: "Green LED",
      ledPin: "GPIO 19",
      reedPin: "GPIO 33",
      ledActiveBg: "bg-emerald-500",
      ledActiveGlowClass: "animate-led-green",
      ledIdleBg: "bg-emerald-950/70 border border-emerald-900/40",
      accentBorder: "border-emerald-500/30",
      glowAccent: "rgba(16, 185, 129, 0.15)",
      labelColor: "text-emerald-400",
    },
    3: {
      ledColorName: "White LED",
      ledPin: "GPIO 23",
      reedPin: "GPIO 25",
      ledActiveBg: "bg-white",
      ledActiveGlowClass: "animate-led-white",
      ledIdleBg: "bg-slate-700/60 border border-slate-600/40",
      accentBorder: "border-slate-300/40",
      glowAccent: "rgba(255, 255, 255, 0.15)",
      labelColor: "text-slate-200",
    },
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-xl">
      {/* Dispenser Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Physical Smart Dispenser Console
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                ESP32 IoT
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Reed switch sensors, multi-color LEDs & passive buzzer
            </p>
          </div>
        </div>

        {/* Real-time Hardware Indicators */}
        <div className="flex items-center gap-2 text-xs">
          {/* Wi-Fi Heartbeat */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium border ${
              deviceOnline
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-slate-800/80 border-slate-700 text-slate-400"
            }`}
          >
            {deviceOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <Wifi className="w-3.5 h-3.5" />
                <span>ESP32 Synced</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>ESP32 Offline</span>
              </>
            )}
          </div>

          {/* Buzzer Indicator (GPIO 26) */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-medium border ${
              buzzerActive
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse"
                : "bg-slate-800 border-slate-700 text-slate-400"
            }`}
          >
            {buzzerActive ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Buzzer Beeping</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                <span>Buzzer Silent</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 md:p-6 space-y-6">
        {/* 1602 LCD Screen Emulation */}
        <div className="rounded-2xl p-4 bg-emerald-950/80 border-2 border-emerald-800/60 shadow-inner font-mono text-emerald-300 relative overflow-hidden">
          <div className="absolute top-2 right-3 text-[10px] tracking-widest text-emerald-500/70 uppercase">
            1602 I2C LCD (0x27)
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs sm:text-sm font-bold tracking-wider">
              <span>[RTC] {rtcTime}</span>
              <span className="text-[11px] text-emerald-400 font-semibold">
                {deviceOnline ? "ONLINE • SYNC OK" : "RTC STANDALONE"}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-emerald-200 font-semibold tracking-wide">
              {pendingCompartment ? (
                <span className="animate-pulse">
                  &gt; COMPARTMENT {pendingCompartment} DOSE DUE! OPEN LID NOW
                </span>
              ) : doses.length > 0 && !doses.some((d) => d.status === "scheduled") ? (
                <span>&gt; ALL DOSES COMPLETED. STANDBY</span>
              ) : (
                <span>&gt; CuraSync ESP32 Ready. Next sync in 5m</span>
              )}
            </div>
          </div>
        </div>

        {/* 3 Physical Compartment Bays */}
        <div>
          <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              Physical Compartments & Reed Switches
            </span>
            <span>Click &apos;Simulate Lid Open&apos; to trigger hardware sensor</span>
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
                  className={`relative rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 border ${
                    isPending
                      ? `${hw.accentBorder} bg-slate-800/90 shadow-lg`
                      : "border-slate-800 bg-slate-800/40 hover:bg-slate-800/60"
                  }`}
                  style={{
                    boxShadow: isPending ? `0 0 24px ${hw.glowAccent}` : undefined,
                  }}
                >
                  {/* Top: Compartment number & LED Diode */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-semibold text-slate-400">
                        Bay #{compNum}
                      </span>
                      <h4 className="text-base font-bold text-white">
                        Compartment {compNum}
                      </h4>
                    </div>

                    {/* Physical LED diode simulation */}
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full inline-block transition-all duration-300 ${
                            isPending
                              ? `${hw.ledActiveBg} ${hw.ledActiveGlowClass}`
                              : hw.ledIdleBg
                          }`}
                          title={`${hw.ledColorName} on ${hw.ledPin}`}
                        />
                        <span className={`text-xs font-semibold ${isPending ? hw.labelColor : "text-slate-500"}`}>
                          {isPending ? "LED ON" : "LED OFF"}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {hw.ledColorName} ({hw.ledPin})
                      </span>
                    </div>
                  </div>

                  {/* Middle: Medication assigned */}
                  <div className="my-2 p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
                    {isConfigured ? (
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-sm font-bold text-slate-100 truncate">
                            {detail.medName}
                          </p>
                          {detail.dosage && (
                            <span className="text-xs text-sky-400 font-medium flex-shrink-0">
                              {detail.dosage}
                            </span>
                          )}
                        </div>

                        {detail.instructions && (
                          <p className="text-[11px] text-slate-400 truncate">
                            {detail.instructions}
                          </p>
                        )}

                        <div className="pt-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">
                            {detail.scheduledTime ? `Time: ${detail.scheduledTime}` : "Daily"}
                          </span>

                          {isPending ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                              Due Now
                            </span>
                          ) : isTaken ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Taken
                            </span>
                          ) : (
                            <span className="text-slate-400">Scheduled</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-center text-xs text-slate-500">
                        <Package className="w-4 h-4 mx-auto mb-1 text-slate-600" />
                        No medication assigned
                      </div>
                    )}
                  </div>

                  {/* Bottom: Reed Switch & Lid Action */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isLidOpening ? "bg-amber-400 animate-ping" : "bg-slate-600"
                        }`}
                      />
                      <span>
                        {isLidOpening ? "Lid Opened!" : "Lid Closed"}
                      </span>
                    </div>

                    <button
                      onClick={() => handleLidClick(compNum)}
                      disabled={isSimulating || isLidOpening}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-slate-600/70 hover:border-slate-500 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                      title={`Simulate reed switch on ${hw.reedPin}`}
                    >
                      <Radio className="w-3 h-3 text-sky-400" />
                      <span>{isLidOpening ? "Triggering..." : "Simulate Lid Open"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostic Pinout Footnote */}
        <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-300">ESP32 Pinout:</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> C1: GPIO 18 (Red LED) / GPIO 32 (Reed)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> C2: GPIO 19 (Green LED) / GPIO 33 (Reed)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white" /> C3: GPIO 23 (White LED) / GPIO 25 (Reed)
            </span>
            <span>Buzzer: GPIO 26</span>
          </div>

          {lastHeartbeat && (
            <span className="text-slate-500">
              Last Ping: {new Date(lastHeartbeat).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
