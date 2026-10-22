"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  PowerOff,
  Pill,
  Clock,
  Loader2,
  X,
  Check,
  Radio,
  Cpu,
  Volume2,
  Sparkles,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncTodayDoseOccurrences } from "@/lib/doses";
import type { Database, CompartmentNumber } from "@/lib/types/database";
import { PrescriptionScanner } from "@/components/ai/PrescriptionScanner";
import { DrugInteractionShield } from "@/components/ai/DrugInteractionShield";

type Medication = Database["public"]["Tables"]["medications"]["Row"];
type Schedule = Database["public"]["Tables"]["medication_schedules"]["Row"];

interface MedicationWithSchedule extends Medication {
  schedules?: Schedule[];
}

const DAYS_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MedicinesPage() {
  const { user } = useAuth();
  const [meds, setMeds] = useState<MedicationWithSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testingMedId, setTestingMedId] = useState<string | null>(null);
  const [editingMed, setEditingMed] = useState<MedicationWithSchedule | null>(null);
  const [deletingMed, setDeletingMed] = useState<MedicationWithSchedule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deviceFeedback, setDeviceFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [compartment, setCompartment] = useState<CompartmentNumber>(1);
  const [time, setTime] = useState("08:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const supabase = createClient();

  const fetchMedications = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: medications, error } = await supabase
      .from("medications")
      .select("*, medication_schedules(*)")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && medications) {
      setMeds(
        medications.map((m) => ({
          ...m,
          schedules: m.medication_schedules as Schedule[],
        }))
      );
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchMedications();
    setStartDate(new Date().toISOString().split("T")[0]);
  }, [fetchMedications]);

  const handleToggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort()
    );
  };

  const handleOpenAddModal = () => {
    setEditingMed(null);
    setName("");
    setDosage("");
    setInstructions("");
    setCompartment(1);
    setTime("08:00");
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (med: MedicationWithSchedule) => {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage || "");
    setInstructions(med.instructions || "");
    const sched = med.schedules?.[0];
    setCompartment(sched?.compartment_number || 1);
    setTime(sched?.scheduled_time ? sched.scheduled_time.slice(0, 5) : "08:00");
    setSelectedDays(sched?.days_of_week && sched.days_of_week.length > 0 ? sched.days_of_week : [0, 1, 2, 3, 4, 5, 6]);
    setStartDate(med.start_date || new Date().toISOString().split("T")[0]);
    setEndDate(med.end_date || "");
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSubmitMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedDays.length === 0) {
      setErrorMsg("Please select at least one day of the week.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (editingMed) {
        // --- EDIT EXISTING MEDICATION ---
        const { error: medError } = await supabase
          .from("medications")
          .update({
            name: name.trim(),
            dosage: dosage.trim() || null,
            instructions: instructions.trim() || null,
            start_date: startDate,
            end_date: endDate ? endDate : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingMed.id);

        if (medError) throw new Error(medError.message);

        const existingSched = editingMed.schedules?.[0];
        if (existingSched) {
          const { error: schedError } = await supabase
            .from("medication_schedules")
            .update({
              compartment_number: compartment,
              scheduled_time: time,
              days_of_week: selectedDays,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSched.id);

          if (schedError) throw new Error(schedError.message);
        } else {
          const { error: schedError } = await supabase
            .from("medication_schedules")
            .insert({
              patient_id: user.id,
              medication_id: editingMed.id,
              compartment_number: compartment,
              scheduled_time: time,
              days_of_week: selectedDays,
              is_active: true,
            });

          if (schedError) throw new Error(schedError.message);
        }

        // Sync dose occurrences
        await syncTodayDoseOccurrences(user.id);

        // Notify ESP32 hardware
        try {
          await fetch("/api/device/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              line1: `MED UPDATED:`,
              line2: `C${compartment}: ${name.toUpperCase().slice(0, 12)}`,
              ring_buzzer: true,
              duration_sec: 8,
            }),
          });
        } catch {}

        setDeviceFeedback({
          type: "success",
          text: `Prescription "${name}" updated and re-assigned to Bay ${compartment}. ESP32 synchronized.`,
        });
      } else {
        // --- CREATE NEW MEDICATION ---
        const { data: newMed, error: medError } = await supabase
          .from("medications")
          .insert({
            patient_id: user.id,
            name: name.trim(),
            dosage: dosage.trim() || null,
            instructions: instructions.trim() || null,
            start_date: startDate,
            end_date: endDate ? endDate : null,
            is_active: true,
          })
          .select()
          .single();

        if (medError || !newMed) {
          throw new Error(medError?.message || "Failed to create medication");
        }

        const { error: schedError } = await supabase
          .from("medication_schedules")
          .insert({
            patient_id: user.id,
            medication_id: newMed.id,
            compartment_number: compartment,
            scheduled_time: time,
            days_of_week: selectedDays,
            is_active: true,
          });

        if (schedError) throw new Error(schedError.message);

        await syncTodayDoseOccurrences(user.id);

        try {
          await fetch("/api/device/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              line1: `MED ADDED: ${name.toUpperCase().slice(0, 5)}`,
              line2: `BAY ${compartment}: ${time}`,
              ring_buzzer: true,
              duration_sec: 8,
            }),
          });
        } catch {}

        setDeviceFeedback({
          type: "success",
          text: `Medication "${name}" saved and assigned to Bay ${compartment}. ESP32 synchronized.`,
        });
      }

      setModalOpen(false);
      setEditingMed(null);
      fetchMedications();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error saving medication");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMedication = async () => {
    if (!deletingMed || !user) return;
    setDeleting(true);

    try {
      const schedIds = deletingMed.schedules?.map((s) => s.id) || [];
      if (schedIds.length > 0) {
        // 1. Delete associated dose occurrences
        await supabase.from("dose_occurrences").delete().in("schedule_id", schedIds);
        // 2. Delete medication schedules
        await supabase.from("medication_schedules").delete().in("id", schedIds);
      }
      // 3. Delete medication record
      const { error } = await supabase.from("medications").delete().eq("id", deletingMed.id);
      if (error) throw new Error(error.message);

      await syncTodayDoseOccurrences(user.id);

      const compNum = deletingMed.schedules?.[0]?.compartment_number || 1;
      try {
        await fetch("/api/device/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            line1: `MED DELETED`,
            line2: `BAY ${compNum} CLEARED`,
            ring_buzzer: false,
            duration_sec: 6,
          }),
        });
      } catch {}

      setDeviceFeedback({
        type: "success",
        text: `Prescription "${deletingMed.name}" deleted and Bay ${compNum} unassigned.`,
      });

      setDeletingMed(null);
      fetchMedications();
    } catch (err: unknown) {
      setDeviceFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to delete medication",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTriggerMedicationAlert = async (med: MedicationWithSchedule) => {
    setTestingMedId(med.id);
    setDeviceFeedback(null);

    const sched = med.schedules?.[0];
    const compNum = sched?.compartment_number || 1;
    const medUpper = med.name.toUpperCase();
    const dosageUpper = (med.dosage || "").toUpperCase();

    const line1 = `TAKE ${medUpper.slice(0, 10)}!`.slice(0, 16);
    const line2 = `BAY ${compNum} - ${dosageUpper || "DOSE DUE"}`.slice(0, 16);

    try {
      const res = await fetch("/api/device/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line1,
          line2,
          ring_buzzer: true,
          duration_sec: 15,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setDeviceFeedback({
          type: "success",
          text: `Dose alert dispatched to ESP32! Bay ${compNum} will alert, LCD will showcase "${line1}", and buzzer will ring.`,
        });
      } else {
        setDeviceFeedback({
          type: "error",
          text: data.error || "Failed to dispatch alert to ESP32.",
        });
      }
    } catch {
      setDeviceFeedback({
        type: "error",
        text: "Network error sending dose alert to ESP32.",
      });
    } finally {
      setTestingMedId(null);
    }
  };

  const handleToggleActive = async (med: Medication) => {
    const updated = !med.is_active;
    const { error } = await supabase
      .from("medications")
      .update({ is_active: updated, updated_at: new Date().toISOString() })
      .eq("id", med.id);

    if (!error) {
      // Also update schedules
      await supabase
        .from("medication_schedules")
        .update({ is_active: updated, updated_at: new Date().toISOString() })
        .eq("medication_id", med.id);

      fetchMedications();
    }
  };

  // AI: fill form from prescription scan
  const handleFillFromScan = (scanned: {
    name: string;
    dosage: string;
    instructions: string;
    suggestedTime: string;
    frequency: string;
    suggestedDays: number[];
    suggestedCompartment: 1 | 2 | 3;
  }) => {
    setEditingMed(null);
    setName(scanned.name || "");
    setDosage(scanned.dosage || "");
    setInstructions(scanned.instructions || "");
    setTime(scanned.suggestedTime || "08:00");
    setCompartment(scanned.suggestedCompartment || 1);
    setSelectedDays(scanned.suggestedDays?.length > 0 ? scanned.suggestedDays : [0, 1, 2, 3, 4, 5, 6]);
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setErrorMsg(null);
    setModalOpen(true);
  };

  // Compute used compartments for scanner suggestion
  const usedCompartments = meds
    .filter((m) => m.is_active)
    .flatMap((m) => m.schedules?.map((s) => s.compartment_number) || []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medicines</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your prescriptions, compartments, and dosage schedules
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PrescriptionScanner
            onFillForm={handleFillFromScan}
            existingCompartments={usedCompartments}
          />
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white text-sm font-semibold rounded-xl hover:bg-sky-600 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add medicine
          </button>
        </div>
      </div>

      {/* Device Feedback Notification */}
      {deviceFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border flex items-start justify-between gap-3 ${
            deviceFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {deviceFeedback.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <span className="w-4 h-4 text-red-600 flex-shrink-0 font-bold">!</span>
            )}
            <span>{deviceFeedback.text}</span>
          </div>
          <button
            onClick={() => setDeviceFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hardware Dispenser Bay Mapping Overview */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold tracking-wide">
              ESP32 Physical Dispenser Bay Assignment
            </h3>
          </div>
          <span className="text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Hardware Synced
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {[1, 2, 3].map((compNum) => {
            const found = meds.find(
              (m) =>
                m.is_active &&
                m.schedules?.some((s) => s.compartment_number === compNum)
            );
            const sched = found?.schedules?.find(
              (s) => s.compartment_number === compNum
            );
            const ledColor =
              compNum === 1
                ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                : compNum === 2
                ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                : "bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]";

            return (
              <div
                key={compNum}
                className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Bay {compNum}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <span className={`w-2 h-2 rounded-full ${ledColor}`} />
                      {compNum === 1 ? "Red" : compNum === 2 ? "Green" : "White"} LED
                    </span>
                  </div>

                  <div className="mt-2 min-h-[38px]">
                    {found ? (
                      <div>
                        <div className="text-xs font-bold text-sky-300 truncate">
                          {found.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {found.dosage || "1 dose"} · {sched?.scheduled_time.slice(0, 5) || "08:00"}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic py-1">
                        Unassigned (Empty Bay)
                      </div>
                    )}
                  </div>
                </div>

                {found && (
                  <button
                    onClick={() => handleTriggerMedicationAlert(found)}
                    disabled={testingMedId === found.id}
                    className="w-full mt-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-[11px] font-semibold text-slate-100 rounded-lg border border-slate-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingMedId === found.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Volume2 className="w-3 h-3 text-sky-400" />
                    )}
                    <span>Trigger Alert</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Drug Interaction Shield */}
      {meds.filter((m) => m.is_active).length >= 2 && (
        <DrugInteractionShield
          medicines={meds
            .filter((m) => m.is_active)
            .map((m) => ({
              name: m.name,
              dosage: m.dosage || undefined,
              instructions: m.instructions || undefined,
              compartment: m.schedules?.[0]?.compartment_number,
            }))}
        />
      )}

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : meds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Pill className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">
            No medicines added yet
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Add your prescriptions and assign them to physical compartments 1, 2, or 3.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-4 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600 cursor-pointer"
          >
            Add first medicine
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {meds.map((med) => {
            const sched = med.schedules?.[0];
            return (
              <div
                key={med.id}
                className={`bg-white rounded-xl border p-5 flex items-center gap-4 transition-all ${
                  med.is_active
                    ? "border-slate-200 shadow-xs"
                    : "border-slate-200 bg-slate-50 opacity-70"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    med.is_active ? "bg-sky-100 text-sky-600" : "bg-slate-200 text-slate-400"
                  }`}
                >
                  <Pill className="w-6 h-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 text-base">
                      {med.name}
                    </h3>
                    {med.dosage && (
                      <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2.5 py-0.5 rounded-full">
                        {med.dosage}
                      </span>
                    )}
                    {sched && (
                      <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-800 font-semibold px-2.5 py-0.5 rounded-full border border-slate-200">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            sched.compartment_number === 1
                              ? "bg-red-500"
                              : sched.compartment_number === 2
                              ? "bg-emerald-500"
                              : "bg-slate-400 border border-slate-600"
                          }`}
                        />
                        Compartment {sched.compartment_number} (
                        {sched.compartment_number === 1
                          ? "Red LED"
                          : sched.compartment_number === 2
                          ? "Green LED"
                          : "White LED"}
                        )
                      </span>
                    )}
                    {!med.is_active && (
                      <span className="text-xs bg-slate-200 text-slate-600 font-medium px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>

                  {med.instructions && (
                    <p className="text-sm text-slate-600 mt-1">{med.instructions}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500">
                    {sched && (
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {sched.scheduled_time.slice(0, 5)} ·{" "}
                        {sched.days_of_week.length === 7
                          ? "Every day"
                          : sched.days_of_week.map((d) => DAYS_NAMES[d]).join(", ")}
                      </span>
                    )}
                    <span>
                      Started {med.start_date}
                      {med.end_date ? ` · Ends ${med.end_date}` : " · Ongoing"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {med.is_active && (
                    <button
                      onClick={() => handleTriggerMedicationAlert(med)}
                      disabled={testingMedId === med.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-lg border border-sky-200 transition-colors cursor-pointer disabled:opacity-50"
                      title="Showcase this medicine on physical ESP32 LCD & ring buzzer"
                    >
                      {testingMedId === med.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Radio className="w-3.5 h-3.5 text-sky-600" />
                      )}
                      <span className="hidden sm:inline">Test on Dispenser</span>
                      <span className="sm:hidden">Test</span>
                    </button>
                  )}

                  {/* Edit Button */}
                  <button
                    onClick={() => handleOpenEditModal(med)}
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-sky-50 text-slate-500 hover:text-sky-600 hover:border-sky-200 transition-all cursor-pointer shadow-2xs"
                    title="Edit Prescription & Schedule"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {/* Toggle Active Button */}
                  <button
                    onClick={() => handleToggleActive(med)}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer shadow-2xs ${
                      med.is_active
                        ? "text-slate-500 hover:text-amber-600 hover:bg-amber-50 border-slate-200 bg-white"
                        : "text-emerald-600 hover:bg-emerald-50 border-emerald-200 bg-emerald-50/50"
                    }`}
                    title={med.is_active ? "Deactivate" : "Activate"}
                  >
                    <PowerOff className="w-4 h-4" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => setDeletingMed(med)}
                    className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer shadow-2xs"
                    title="Delete Prescription"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Medicine Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {editingMed ? (
                  <>
                    <Pencil className="w-5 h-5 text-sky-600" />
                    <span>Edit Prescription & Schedule</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 text-sky-600" />
                    <span>Add New Medication</span>
                  </>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {!editingMed && (
                  <PrescriptionScanner
                    onFillForm={(scanned) => {
                      setName(scanned.name || "");
                      setDosage(scanned.dosage || "");
                      setInstructions(scanned.instructions || "");
                      setTime(scanned.suggestedTime || "08:00");
                      setCompartment(scanned.suggestedCompartment || 1);
                      setSelectedDays(scanned.suggestedDays?.length > 0 ? scanned.suggestedDays : [0, 1, 2, 3, 4, 5, 6]);
                    }}
                    existingCompartments={usedCompartments}
                  />
                )}
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setEditingMed(null);
                  }}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmitMedication} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Medicine Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Metformin, Atorvastatin"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Dosage
                  </label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 500mg, 1 tablet"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Hardware Compartment *
                  </label>
                  <select
                    value={compartment}
                    onChange={(e) =>
                      setCompartment(Number(e.target.value) as CompartmentNumber)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value={1}>Bay 1 (Red LED • GPIO 18)</option>
                    <option value={2}>Bay 2 (Green LED • GPIO 19)</option>
                    <option value={3}>Bay 3 (White LED • GPIO 23)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Instructions
                </label>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Take with warm water after meals"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Scheduled Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Frequency (Days) *
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS_NAMES.map((d, idx) => {
                    const active = selectedDays.includes(idx);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleToggleDay(idx)}
                        className={`py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          active
                            ? "bg-sky-500 text-white border-sky-500 shadow-2xs font-semibold"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    setEditingMed(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-sky-500 text-white text-sm font-semibold rounded-lg hover:bg-sky-600 disabled:opacity-60 cursor-pointer shadow-xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{editingMed ? "Saving..." : "Creating..."}</span>
                    </>
                  ) : (
                    <span>{editingMed ? "Save Changes" : "Save Medicine"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delete Prescription?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure you want to remove this medication?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Medicine:</span>
                <span className="font-bold text-slate-900">{deletingMed.name}</span>
              </div>
              {deletingMed.dosage && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Dosage:</span>
                  <span className="text-slate-700">{deletingMed.dosage}</span>
                </div>
              )}
              {deletingMed.schedules?.[0] && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Hardware Bay:</span>
                  <span className="font-semibold text-slate-800">
                    Compartment {deletingMed.schedules[0].compartment_number}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500">
              This action will unassign the dispenser compartment, clear upcoming dose alarms, and remove the prescription record permanently.
            </p>

            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingMed(null)}
                disabled={deleting}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMedication}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Prescription</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
