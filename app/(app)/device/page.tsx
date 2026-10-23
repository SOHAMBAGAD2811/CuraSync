"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Cpu,
  Wifi,
  WifiOff,
  Activity,
  Key,
  Copy,
  Check,
  RefreshCw,
  Play,
  Loader2,
  Tv,
  Send,
  Volume2,
  VolumeX,
  Clock,
  Radio,
  Magnet,
  DoorOpen,
  DoorClosed,
  BellOff,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Database, CompartmentNumber } from "@/lib/types/database";

type Device = Database["public"]["Tables"]["devices"]["Row"];
type DeviceEvent = Database["public"]["Tables"]["device_events"]["Row"];

export default function DevicePage() {
  const { user } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string | null>(null);

  // Magnetic Reed Switch Testing State
  const [reedStates, setReedStates] = useState<{ [key in CompartmentNumber]: "HIGH" | "LOW" }>({
    1: "LOW",
    2: "LOW",
    3: "LOW",
  });
  const [testingReed, setTestingReed] = useState<CompartmentNumber | null>(null);

  // LCD Remote Showcase State
  const [lcdLine1, setLcdLine1] = useState("TAKE CITAFIL 5MG");
  const [lcdLine2, setLcdLine2] = useState("COMPARTMENT 1");
  const [ringBuzzer, setRingBuzzer] = useState(true);
  const [durationSec, setDurationSec] = useState(15);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgStatus, setMsgStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchDeviceData = useCallback(async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoading(true);

    // 1. Fetch patient's device
    let { data: dev } = await supabase
      .from("devices")
      .select("*")
      .eq("patient_id", user.id)
      .maybeSingle();

    // If no device exists yet, auto-register one for the patient
    if (!dev) {
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

    setDevice(dev ?? null);

    // 2. Fetch recent device events
    if (dev) {
      const { data: eventList } = await supabase
        .from("device_events")
        .select("*")
        .eq("patient_id", user.id)
        .order("event_time", { ascending: false })
        .limit(15);

      setEvents(eventList || []);
      const latestHeartbeat = eventList?.find((event) => event.event_type === "heartbeat");
      const payload = latestHeartbeat?.raw_payload;
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const reedReadings = (payload as Record<string, unknown>).reed_states;
        if (Array.isArray(reedReadings)) {
          setReedStates((current) => {
            const next = { ...current };
            for (const reading of reedReadings) {
              if (!reading || typeof reading !== "object") continue;
              const item = reading as { bay?: unknown; level?: unknown };
              if ((item.bay === 1 || item.bay === 2 || item.bay === 3) &&
                  (item.level === "HIGH" || item.level === "LOW")) {
                next[item.bay] = item.level;
              }
            }
            return next;
          });
        }
      }
    }

    if (showLoading) setLoading(false);
    setCurrentTime(Date.now());
  }, [user, supabase]);

  useEffect(() => {
    const initialFetch = window.setTimeout(() => void fetchDeviceData(), 0);
    const refreshTimer = window.setInterval(() => {
      if (!document.hidden) {
        setCurrentTime(Date.now());
        void fetchDeviceData(false);
      }
    }, 15000);

    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(refreshTimer);
    };
  }, [fetchDeviceData]);

  const copyDeviceKey = () => {
    if (!device) return;
    navigator.clipboard.writeText(device.device_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOnline = Boolean(
    device?.last_heartbeat_at &&
      currentTime - new Date(device.last_heartbeat_at).getTime() < 5 * 60 * 1000
  );

  // LCD Remote Control Dispatch
  const handleSendLcdMessage = async () => {
    if (!device) return;
    setSendingMsg(true);
    setMsgStatus(null);

    try {
      const res = await fetch("/api/device/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_key: device.device_key,
          line1: lcdLine1,
          line2: lcdLine2,
          ring_buzzer: ringBuzzer,
          duration_sec: durationSec,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMsgStatus({
          type: "success",
          text: `Message queued for physical LCD! ESP32 polls every 15s and will show "${lcdLine1.slice(0, 16)}" with buzzer ${ringBuzzer ? "RINGING" : "off"}.`,
        });
      } else {
        setMsgStatus({
          type: "error",
          text: data.error || "Failed to transmit message to device.",
        });
      }
    } catch {
      setMsgStatus({
        type: "error",
        text: "Network error sending message to device.",
      });
    } finally {
      setSendingMsg(false);
    }
  };

  const applyPreset = (line1: string, line2: string, buzzer: boolean) => {
    setLcdLine1(line1);
    setLcdLine2(line2);
    setRingBuzzer(buzzer);
  };

  // Simulation test functions calling real backend endpoints
  const handleSimulateHeartbeat = async () => {
    if (!device) return;
    setSimulating(true);
    setSimStatus("Sending device connection ping...");

    try {
      const res = await fetch("/api/device/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_key: device.device_key, status: "OK" }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.custom_msg) {
          setSimStatus(
            `Connection ping acknowledged! ESP32 picked up queued message: "${data.custom_msg.line1}" / "${data.custom_msg.line2}" (Buzzer: ${data.custom_msg.ring_buzzer ? "RINGING" : "OFF"})`
          );
        } else {
          setSimStatus("Connection ping acknowledged! Device is now Online.");
        }
      } else {
        setSimStatus(`Error: ${data.error}`);
      }
      fetchDeviceData();
    } catch {
      setSimStatus("Failed to send simulation request.");
    } finally {
      setSimulating(false);
    }
  };

  const REED_PINS: Record<CompartmentNumber, number> = { 1: 32, 2: 33, 3: 25 };

  const REED_BAYS: {
    num: CompartmentNumber;
    name: string;
    reedPin: number;
    sensorType: string;
    ledPin: number;
    ledColor: string;
    ledColorName: string;
  }[] = [
    {
      num: 1,
      name: "Compartment 1",
      reedPin: 32,
      sensorType: "Digital reed module",
      ledPin: 18,
      ledColor: "#ef4444",
      ledColorName: "Red",
    },
    {
      num: 2,
      name: "Compartment 2",
      reedPin: 33,
      sensorType: "Digital reed module",
      ledPin: 19,
      ledColor: "#10b981",
      ledColorName: "Green",
    },
    {
      num: 3,
      name: "Compartment 3",
      reedPin: 25,
      sensorType: "Mini reed switch",
      ledPin: 23,
      ledColor: "#cbd5e1",
      ledColorName: "White",
    },
  ];

  const handleTestReedSwitch = async (
    compNum: CompartmentNumber,
    targetState: "LOW" | "HIGH"
  ) => {
    if (!device) return;
    setSimulating(true);
    setTestingReed(compNum);
    const eventType = targetState === "HIGH" ? "compartment_open" : "compartment_close";
    const pin = REED_PINS[compNum];

    setSimStatus(
      targetState === "HIGH"
        ? `Testing Reed ${compNum} (GPIO ${pin}) -> HIGH: Lid opened (magnet removed), buzzer silenced & dose confirmed.`
        : `Testing Reed ${compNum} (GPIO ${pin}) -> LOW: Lid closed (magnet detected).`
    );

    try {
      const res = await fetch("/api/device/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_key: device.device_key,
          event_type: eventType,
          compartment_number: compNum,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReedStates((prev) => ({ ...prev, [compNum]: targetState }));
        if (targetState === "HIGH") {
          // Also queue a silence-command so the physical ESP32 buzzer stops
          // on the next heartbeat poll (within 5 s), even if the physical
          // reed hasn't been physically moved.
          try {
            await fetch("/api/device/message", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                device_key: device.device_key,
                line1: "DOSE TAKEN! OK",
                line2: `Bay ${compNum}: confirmed`,
                ring_buzzer: false,
                duration_sec: 1,
              }),
            });
          } catch {
            // Non-critical — event was still logged
          }
          setSimStatus(
            data.dose_acknowledged
              ? `Reed ${compNum} (GPIO ${pin}) triggered HIGH! Buzzer silenced, LED blinking stopped, dose acknowledged!`
              : `Reed ${compNum} (GPIO ${pin}) triggered HIGH! Buzzer silenced, LED blinking stopped, event recorded.`
          );
        } else {
          setSimStatus(
            `Reed ${compNum} (GPIO ${pin}) returned to LOW (Magnet Contact / Lid Closed).`
          );
        }
      } else {
        setSimStatus(`Error: ${data.error}`);
      }
      fetchDeviceData();
    } catch {
      setSimStatus("Failed to send reed switch simulation request.");
    } finally {
      setSimulating(false);
      setTestingReed(null);
    }
  };

  const handleSimulateFullDoseCycle = async (compNum: CompartmentNumber) => {
    await handleTestReedSwitch(compNum, "HIGH");
    setTimeout(async () => {
      await handleTestReedSwitch(compNum, "LOW");
    }, 2200);
  };


  const handleSimulateCompartmentOpen = async (compNum: CompartmentNumber) => {
    if (!device) return;
    setSimulating(true);
    setSimStatus(`Simulating opening Compartment ${compNum}...`);

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
        setSimStatus(
          data.dose_acknowledged
            ? `Compartment ${compNum} opened! Matching dose acknowledged.`
            : `Compartment ${compNum} opened event logged.`
        );
      } else {
        setSimStatus(`Error: ${data.error}`);
      }
      fetchDeviceData();
    } catch {
      setSimStatus("Failed to send simulation request.");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ESP32 Device</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Hardware status, compartment sensors, and firmware integration
          </p>
        </div>
        <button
          onClick={() => fetchDeviceData()}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Status
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : (
        <>
          {/* Device Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-7 h-7 text-sky-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {device?.label || "ESP32 Dispenser Unit"}
                    </h2>
                    <span
                      className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        isOnline
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isOnline ? (
                        <Wifi className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-slate-400" />
                      )}
                      {isOnline ? "Online" : "Offline"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hardware: ESP32 + DS3231 RTC + 3 Reed Switches + Buzzer + 1602 LCD
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {device?.last_heartbeat_at
                      ? `Last seen: ${new Date(device.last_heartbeat_at).toLocaleString()}`
                      : "No connection ping received yet."}
                  </p>
                </div>
              </div>
            </div>

            {/* Device Key */}
            {device && (
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <Key className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    ESP32 Device Key:
                  </span>
                  <code className="text-xs font-mono text-slate-800 bg-white px-2 py-1 rounded-md border border-slate-200 truncate">
                    {device.device_key}
                  </code>
                </div>
                <button
                  onClick={copyDeviceKey}
                  className="flex items-center gap-1 text-xs font-semibold text-sky-700 bg-white hover:bg-sky-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors self-start sm:self-auto"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Key
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Interactive 1602 LCD & Buzzer Showcase */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Tv className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      1602 LCD & Buzzer Remote Control
                    </h2>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Live Hardware Link
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Type a message to showcase on the physical 16x2 LCD display & ring the buzzer
                  </p>
                </div>
              </div>
            </div>

            {/* Virtual 1602 LCD Hardware Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  Physical 1602 LCD (0x27) Live Preview
                </span>
                <span className="font-mono text-[11px] text-slate-400">16 Columns x 2 Rows</span>
              </div>

              {/* Retro Hardware LCD Screen Frame */}
              <div className="p-3 bg-slate-900 rounded-xl shadow-inner border-2 border-slate-700/80">
                <div className="relative bg-[#143321] rounded-lg p-4 font-mono border border-[#235838] shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)] overflow-hidden">
                  {/* Subtle LCD sub-pixel grid overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1f4b30_1px,transparent_1px)] [background-size:4px_4px] opacity-30 pointer-events-none" />

                  {/* Row 1 */}
                  <div className="relative text-base sm:text-lg tracking-[0.25em] font-bold text-[#86efac] drop-shadow-[0_0_8px_rgba(134,239,172,0.8)] whitespace-pre font-mono leading-relaxed select-none">
                    {lcdLine1.slice(0, 16).padEnd(16, " ")}
                  </div>
                  {/* Row 2 */}
                  <div className="relative text-base sm:text-lg tracking-[0.25em] font-bold text-[#86efac] drop-shadow-[0_0_8px_rgba(134,239,172,0.8)] whitespace-pre font-mono leading-relaxed select-none mt-1">
                    {lcdLine2.slice(0, 16).padEnd(16, " ")}
                  </div>

                  {/* LCD Overlay indicators */}
                  <div className="mt-3 pt-2 border-t border-[#235838]/60 flex items-center justify-between text-[10px] text-[#4ade80]/70 font-mono tracking-wider">
                    <span>CURASYNC I2C 0x27</span>
                    <span className="flex items-center gap-1">
                      {ringBuzzer ? (
                        <>
                          <Volume2 className="w-3 h-3 text-[#86efac] animate-pulse" />
                          BUZZER ARMED ({durationSec}s)
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3 h-3 text-slate-400" />
                          BUZZER MUTED
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Quick Presets:</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("TAKE CITAFIL 5MG", "COMPARTMENT 1", true)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>💊</span>
                  <span>Take Citafil (C1)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("HYDRATION ALERT", "DRINK 250ML H2O", true)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>💧</span>
                  <span>Drink Water</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("URGENT ALERT!", "CALL CAREGIVER", true)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>🚨</span>
                  <span>Emergency Alert</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("BUZZER TEST OK!", "CURASYNC ONLINE", true)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>🔔</span>
                  <span>Test Buzzer Sound</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("WELCOME HOME", "READY TO SYNC", false)}
                  className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                >
                  <span>✨</span>
                  <span>Custom Welcome</span>
                </button>
              </div>
            </div>

            {/* Form Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Line 1 Text</label>
                  <span
                    className={`text-[11px] font-mono ${
                      lcdLine1.length > 16 ? "text-red-500 font-bold" : "text-slate-400"
                    }`}
                  >
                    {lcdLine1.length}/16
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={16}
                  value={lcdLine1}
                  onChange={(e) => setLcdLine1(e.target.value.toUpperCase())}
                  placeholder="LINE 1 MESSAGE"
                  className="w-full text-xs font-mono uppercase px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Line 2 Text</label>
                  <span
                    className={`text-[11px] font-mono ${
                      lcdLine2.length > 16 ? "text-red-500 font-bold" : "text-slate-400"
                    }`}
                  >
                    {lcdLine2.length}/16
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={16}
                  value={lcdLine2}
                  onChange={(e) => setLcdLine2(e.target.value.toUpperCase())}
                  placeholder="LINE 2 MESSAGE"
                  className="w-full text-xs font-mono uppercase px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>
            </div>

            {/* Options & Dispatch Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={ringBuzzer}
                    onChange={(e) => setRingBuzzer(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <span>Ring Physical Buzzer (GPIO 26)</span>
                </label>

                <div className="flex items-center gap-1.5 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Display Duration:</span>
                  <select
                    value={durationSec}
                    onChange={(e) => setDurationSec(Number(e.target.value))}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-md px-2 py-1 font-medium"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleSendLcdMessage}
                disabled={sendingMsg || !device}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {sendingMsg ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending to ESP32...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Showcase on Physical LCD</span>
                  </>
                )}
              </button>
            </div>

            {msgStatus && (
              <div
                className={`p-3 rounded-xl text-xs font-medium border flex items-start gap-2 ${
                  msgStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-red-50 text-red-800 border-red-200"
                }`}
              >
                {msgStatus.type === "success" ? (
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <span className="w-4 h-4 text-red-600 flex-shrink-0 font-bold">!</span>
                )}
                <span>{msgStatus.text}</span>
              </div>
            )}
          </div>

          {/* Magnetic Reed Switch Hardware Diagnostics Bench */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                  <Magnet className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Magnetic Reed Switch Sensor Diagnostics
                    </h2>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                      Live GPIO + Simulator
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live ESP32 reed readings refresh every 15 seconds. The buttons below send simulated events only.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bays 1–2: digital modules · Bay 3: mini reed</span>
              </div>
            </div>

            {/* Reed Switches Grid (3 Bays) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {REED_BAYS.map((bay) => {
                const isLow = reedStates[bay.num] === "LOW";
                const isBeingTested = testingReed === bay.num && simulating;

                return (
                  <div
                    key={bay.num}
                    className={`rounded-xl border p-4 transition-all duration-200 space-y-3.5 ${
                      !isLow
                        ? "bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/20 shadow-xs"
                        : "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Bay Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-black/15 shadow-2xs"
                          style={{ backgroundColor: bay.ledColor }}
                        />
                        <span className="font-bold text-xs text-slate-800">
                          {bay.name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-md uppercase border ${
                          !isLow
                            ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {isLow ? "LID CLOSED (LOW)" : "LID OPEN (HIGH)"}
                      </span>
                    </div>

                    {/* Technical Pinout Specs */}
                    <div className="bg-white rounded-lg p-2.5 border border-slate-200/80 text-[11px] space-y-1 font-mono text-slate-600">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Reed Pin:</span>
                        <span className="font-semibold text-slate-800">GPIO {bay.reedPin}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Sensor:</span>
                        <span className="font-semibold text-slate-800">{bay.sensorType}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Paired Alert LED:</span>
                        <span className="font-semibold text-slate-800">
                          GPIO {bay.ledPin} ({bay.ledColorName})
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Magnet State:</span>
                        <span className={`font-semibold ${isLow ? "text-slate-700" : "text-amber-600"}`}>
                          {isLow ? "Detected (Lid Closed)" : "Removed (Lid Open)"}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleTestReedSwitch(bay.num, "HIGH")}
                          disabled={simulating}
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold rounded-lg transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                          title="Simulates lifting lid (Reed sends HIGH, silences buzzer)"
                        >
                          <DoorOpen className="w-3.5 h-3.5" />
                          <span>Open (HIGH)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestReedSwitch(bay.num, "LOW")}
                          disabled={simulating}
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-lg transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                          title="Simulates closing lid (Reed sends LOW, magnet detected)"
                        >
                          <DoorClosed className="w-3.5 h-3.5" />
                          <span>Close (LOW)</span>
                        </button>
                      </div>

                      {/* Quick Ingestion Cycle Test */}
                      <button
                        type="button"
                        onClick={() => handleSimulateFullDoseCycle(bay.num)}
                        disabled={simulating}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-[11px] font-semibold rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isBeingTested ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-violet-600" />
                        )}
                        <span>Quick Intake Test (Open → Close)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Auto-Silence & Safety Verification Note */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
              <BellOff className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-800">
                  Closed Magnet Holds Dose Alarm Until Bay Opens
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  At a scheduled time, a closed bay keeps its LED reminder and buzzer snooze active. Removing the magnet opens the bay, clears that bay&apos;s reminder, silences its buzzer, and sends a dose event. Bays 1–2 use digital module outputs; Bay 3 uses the mini reed input. Open/closed polarity is set in the ESP32 firmware.
                </p>
              </div>
            </div>
          </div>

          {/* Hardware Simulator Toolbar */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm tracking-wide">
                  ESP32 Hardware Simulator & Testing Console
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                Local Test Bench
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Test end-to-end hardware synchronization without needing the physical ESP32 powered on. These actions trigger the exact same API requests that the firmware executes.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleSimulateHeartbeat}
                disabled={simulating}
                className="px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-xs font-semibold rounded-xl text-white transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                Send Connection Ping
              </button>
              <button
                onClick={() => handleSimulateCompartmentOpen(1)}
                disabled={simulating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-red-500/40 text-xs font-semibold rounded-xl text-slate-100 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>Open C1 (Red LED)</span>
              </button>
              <button
                onClick={() => handleSimulateCompartmentOpen(2)}
                disabled={simulating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 text-xs font-semibold rounded-xl text-slate-100 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Open C2 (Green LED)</span>
              </button>
              <button
                onClick={() => handleSimulateCompartmentOpen(3)}
                disabled={simulating}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-300/40 text-xs font-semibold rounded-xl text-slate-100 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <span className="w-2 h-2 rounded-full bg-white" />
                <span>Open C3 (White LED)</span>
              </button>
            </div>

            {simStatus && (
              <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-sky-300 font-mono">
                {simStatus}
              </div>
            )}
          </div>

          {/* Event Log */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-800">
                Recent Hardware Event Log
              </h2>
            </div>

            {events.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No device events recorded yet. Use the simulator above to verify!
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          e.event_type === "compartment_open"
                            ? "bg-sky-500 ring-2 ring-sky-200"
                            : "bg-emerald-500"
                        }`}
                      />
                      <span className="font-semibold text-slate-800">
                        {e.event_type === "compartment_open"
                          ? `Compartment ${e.compartment_number} Opened (Reed Switch Triggered)`
                          : "Device Connection Ping / Keepalive"}
                      </span>
                    </div>
                    <span className="text-slate-400">
                      {new Date(e.event_time).toLocaleTimeString()}
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
