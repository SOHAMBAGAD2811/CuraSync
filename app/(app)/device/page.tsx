"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Cpu,
  Wifi,
  WifiOff,
  Activity,
  Package,
  Key,
  Copy,
  Check,
  RefreshCw,
  Play,
  Loader2,
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
  const [copied, setCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simStatus, setSimStatus] = useState<string | null>(null);

  const supabase = createClient();

  const fetchDeviceData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

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
    }

    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchDeviceData();
  }, [fetchDeviceData]);

  const copyDeviceKey = () => {
    if (!device) return;
    navigator.clipboard.writeText(device.device_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isOnline = Boolean(
    device?.last_heartbeat_at &&
      Date.now() - new Date(device.last_heartbeat_at).getTime() < 5 * 60 * 1000
  );

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
        setSimStatus("Connection ping acknowledged! Device is now Online.");
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
