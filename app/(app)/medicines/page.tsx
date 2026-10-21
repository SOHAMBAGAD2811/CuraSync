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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { syncTodayDoseOccurrences } from "@/lib/doses";
import type { Database, CompartmentNumber } from "@/lib/types/database";

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

  const handleCreateMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedDays.length === 0) {
      setErrorMsg("Please select at least one day of the week.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Insert into medications
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

      // 2. Insert into medication_schedules
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

      if (schedError) {
        throw new Error(schedError.message);
      }

      // 3. Automatically synchronize today's dose occurrences
      await syncTodayDoseOccurrences(user.id);

      // Reset form & reload
      setName("");
      setDosage("");
      setInstructions("");
      setCompartment(1);
      setTime("08:00");
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
      setModalOpen(false);
      fetchMedications();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error saving medication");
    } finally {
      setSubmitting(false);
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medicines</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your prescriptions, compartments, and dosage schedules
          </p>
        </div>
        <button
          onClick={() => {
            setErrorMsg(null);
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white text-sm font-semibold rounded-xl hover:bg-sky-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add medicine
        </button>
      </div>

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
            onClick={() => setModalOpen(true)}
            className="mt-4 px-4 py-2 bg-sky-500 text-white text-sm font-medium rounded-lg hover:bg-sky-600"
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

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(med)}
                    className={`p-2 rounded-lg border transition-colors ${
                      med.is_active
                        ? "text-slate-500 hover:text-red-600 hover:bg-red-50 border-slate-200"
                        : "text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                    }`}
                    title={med.is_active ? "Deactivate" : "Activate"}
                  >
                    <PowerOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Medicine Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                Add New Medication
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateMedication} className="space-y-4">
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
                    Compartment *
                  </label>
                  <select
                    value={compartment}
                    onChange={(e) =>
                      setCompartment(Number(e.target.value) as CompartmentNumber)
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
                  >
                    <option value={1}>Compartment 1 (Red LED • GPIO 18)</option>
                    <option value={2}>Compartment 2 (Green LED • GPIO 19)</option>
                    <option value={3}>Compartment 3 (White LED • GPIO 23)</option>
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
                        className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          active
                            ? "bg-sky-500 text-white border-sky-500"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-sky-500 text-white text-sm font-semibold rounded-lg hover:bg-sky-600 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Medicine"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
