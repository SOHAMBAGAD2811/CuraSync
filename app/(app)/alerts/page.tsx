"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Database } from "@/lib/types/database";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type SOSAlert = Database["public"]["Tables"]["sos_alerts"]["Row"];

export default function AlertsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sosList, setSosList] = useState<SOSAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [sosNotes, setSosNotes] = useState("");
  const [submittingSos, setSubmittingSos] = useState(false);

  const supabase = createClient();

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [notifRes, sosRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("sos_alerts")
        .select("*")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (notifRes.data) setNotifications(notifRes.data);
    if (sosRes.data) setSosList(sosRes.data);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleTriggerSOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmittingSos(true);

    try {
      // 1. Insert SOS record
      await supabase.from("sos_alerts").insert({
        patient_id: user.id,
        status: "active",
        notes: sosNotes.trim() || "Emergency SOS triggered by patient.",
      });

      // 2. Also create notification record
      await supabase.from("notifications").insert({
        patient_id: user.id,
        type: "sos",
        title: "EMERGENCY SOS ALERT",
        body: sosNotes.trim() || "Emergency SOS event was initiated.",
      });

      setSosNotes("");
      setSosModalOpen(false);
      fetchAlerts();
    } catch (e) {
      console.error("SOS trigger error:", e);
    } finally {
      setSubmittingSos(false);
    }
  };

  const handleResolveSOS = async (id: string) => {
    await supabase
      .from("sos_alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    fetchAlerts();
  };

  const handleMarkAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alerts & SOS</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Dose reminders, late notifications, and emergency SOS event management
          </p>
        </div>
        <button
          onClick={() => setSosModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all shadow-md active:scale-95"
        >
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          Trigger SOS
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : (
        <>
          {/* Active SOS Alerts banner if any */}
          {sosList.some((s) => s.status === "active") && (
            <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-red-700 font-bold text-base">
                <ShieldAlert className="w-6 h-6 animate-bounce" />
                Active Emergency SOS Signal
              </div>
              {sosList
                .filter((s) => s.status === "active")
                .map((s) => (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl p-4 border border-red-200 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {s.notes}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Triggered at: {new Date(s.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleResolveSOS(s.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                    >
                      Mark Resolved
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Notifications / Alerts list */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Recent Notifications
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No alerts or notifications recorded.
              </p>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                      n.type === "sos"
                        ? "bg-red-50 border-red-200"
                        : n.type === "dose_missed"
                        ? "bg-amber-50/60 border-amber-200"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <Bell className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="text-xs font-medium text-sky-600 hover:underline flex-shrink-0"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SOS History */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              SOS Event History
            </h2>
            {sosList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No past SOS events.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {sosList.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {s.notes || "SOS Alert"}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            s.status === "active"
                              ? "bg-red-100 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(s.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Trigger SOS Modal */}
      {sosModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
                <ShieldAlert className="w-5 h-5" />
                Trigger Emergency SOS
              </div>
              <button
                onClick={() => setSosModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              This records an immediate emergency SOS event in CuraSync and alerts connected caregivers.
            </p>

            <form onSubmit={handleTriggerSOS} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional description or symptoms
                </label>
                <textarea
                  value={sosNotes}
                  onChange={(e) => setSosNotes(e.target.value)}
                  placeholder="e.g. Feeling dizzy, chest discomfort, need assistance..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSosModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSos}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-60"
                >
                  {submittingSos ? "Broadcasting..." : "Confirm SOS Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
