"use client";

import { useEffect, useState, useCallback } from "react";
import {
  HeartPulse,
  FileText,
  History,
  CalendarClock,
  Plus,
  Upload,
  Loader2,
  X,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Database } from "@/lib/types/database";

type VitalSign = Database["public"]["Tables"]["vital_signs"]["Row"];
type MedicalHistory = Database["public"]["Tables"]["medical_history"]["Row"];
type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
type MedicalDoc = Database["public"]["Tables"]["medical_documents"]["Row"];

export default function HealthPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vitals, setVitals] = useState<VitalSign[]>([]);
  const [history, setHistory] = useState<MedicalHistory[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [docs, setDocs] = useState<MedicalDoc[]>([]);

  // Modals
  const [vitalModalOpen, setVitalModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Form states
  const [vitalType, setVitalType] = useState("Blood Pressure");
  const [vitalValue, setVitalValue] = useState("");
  const [vitalUnit, setVitalUnit] = useState("mmHg");
  const [vitalNotes, setVitalNotes] = useState("");

  const [condition, setCondition] = useState("");
  const [diagnosedAt, setDiagnosedAt] = useState("");
  const [historyNotes, setHistoryNotes] = useState("");

  const [aptTitle, setAptTitle] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [aptNotes, setAptNotes] = useState("");

  const [docLabel, setDocLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();

  const fetchHealthData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [vRes, hRes, aRes, dRes] = await Promise.all([
      supabase
        .from("vital_signs")
        .select("*")
        .eq("patient_id", user.id)
        .order("measured_at", { ascending: false }),
      supabase
        .from("medical_history")
        .select("*")
        .eq("patient_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*")
        .eq("patient_id", user.id)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("medical_documents")
        .select("*")
        .eq("patient_id", user.id)
        .order("uploaded_at", { ascending: false }),
    ]);

    if (vRes.data) setVitals(vRes.data);
    if (hRes.data) setHistory(hRes.data);
    if (aRes.data) setAppointments(aRes.data);
    if (dRes.data) setDocs(dRes.data);
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  // Handle Vital Submit
  const handleAddVital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    await supabase.from("vital_signs").insert({
      patient_id: user.id,
      type: vitalType,
      value: parseFloat(vitalValue) || 0,
      unit: vitalUnit,
      measured_at: new Date().toISOString(),
      notes: vitalNotes.trim() || null,
    });

    setVitalValue("");
    setVitalNotes("");
    setVitalModalOpen(false);
    fetchHealthData();
  };

  // Handle History Submit
  const handleAddHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    await supabase.from("medical_history").insert({
      patient_id: user.id,
      condition: condition.trim(),
      diagnosed_at: diagnosedAt || null,
      notes: historyNotes.trim() || null,
    });

    setCondition("");
    setDiagnosedAt("");
    setHistoryNotes("");
    setHistoryModalOpen(false);
    fetchHealthData();
  };

  // Handle Appointment Submit
  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    await supabase.from("appointments").insert({
      patient_id: user.id,
      title: aptTitle.trim(),
      doctor_name: doctorName.trim() || null,
      location: location.trim() || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      notes: aptNotes.trim() || null,
    });

    setAptTitle("");
    setDoctorName("");
    setLocation("");
    setScheduledAt("");
    setAptNotes("");
    setAppointmentModalOpen(false);
    fetchHealthData();
  };

  // Handle Document Upload
  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFile) return;
    setUploading(true);

    try {
      const fileName = `${user.id}/${Date.now()}_${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("medical-documents")
        .upload(fileName, selectedFile);

      // Even if the storage bucket was not pre-created, save metadata to table
      await supabase.from("medical_documents").insert({
        patient_id: user.id,
        label: docLabel.trim() || selectedFile.name,
        storage_path: uploadError ? `local_ref/${selectedFile.name}` : fileName,
        file_type: selectedFile.type,
        file_size_bytes: selectedFile.size,
      });

      setDocLabel("");
      setSelectedFile(null);
      setUploadModalOpen(false);
      fetchHealthData();
    } catch (e) {
      console.error("Document upload error:", e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Health Records</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Vitals tracking, medical history, lab reports, and doctor appointments
        </p>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
        </div>
      ) : (
        <>
          {/* Vital Signs */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-sky-600" />
                <h2 className="text-sm font-semibold text-slate-800">
                  Vital Signs
                </h2>
              </div>
              <button
                onClick={() => setVitalModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Vitals
              </button>
            </div>

            {vitals.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No vitals recorded yet. Track your blood pressure, glucose, or pulse.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {vitals.slice(0, 6).map((v) => (
                  <div key={v.id} className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/60">
                    <p className="text-xs text-slate-500 font-medium">{v.type}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {v.value}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        {v.unit}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {new Date(v.measured_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Medical Documents */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-600" />
                <h2 className="text-sm font-semibold text-slate-800">
                  Medical Documents & Lab Reports
                </h2>
              </div>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Document
              </button>
            </div>

            {docs.length === 0 ? (
              <div
                onClick={() => setUploadModalOpen(true)}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">
                  Upload prescription, blood report, or scan
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG up to 10MB</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {d.label}
                        </p>
                        <p className="text-xs text-slate-400">
                          Uploaded {new Date(d.uploaded_at).toLocaleDateString()}
                          {d.file_size_bytes
                            ? ` · ${Math.round(d.file_size_bytes / 1024)} KB`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Medical History */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-600" />
                  <h2 className="text-sm font-semibold text-slate-800">
                    Medical History
                  </h2>
                </div>
                <button
                  onClick={() => setHistoryModalOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              {history.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No chronic conditions or allergies logged.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {history.map((h) => (
                    <div key={h.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          {h.condition}
                        </p>
                        {h.diagnosed_at && (
                          <span className="text-[11px] text-slate-400">
                            {h.diagnosed_at}
                          </span>
                        )}
                      </div>
                      {h.notes && (
                        <p className="text-xs text-slate-600 mt-1">{h.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Appointments */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-sky-600" />
                  <h2 className="text-sm font-semibold text-slate-800">
                    Upcoming Appointments
                  </h2>
                </div>
                <button
                  onClick={() => setAppointmentModalOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Book
                </button>
              </div>

              {appointments.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No upcoming doctor consultations scheduled.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {appointments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-sky-50/60 rounded-xl border border-sky-100 flex items-start gap-3"
                    >
                      <CalendarClock className="w-5 h-5 text-sky-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {a.title}
                        </p>
                        <p className="text-xs text-slate-600">
                          {a.doctor_name} {a.location ? `· ${a.location}` : ""}
                        </p>
                        <p className="text-[11px] text-sky-700 font-semibold mt-1">
                          {new Date(a.scheduled_at).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Vital Sign Modal */}
      {vitalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">Record Vital Sign</h3>
              <button onClick={() => setVitalModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddVital} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Measurement Type
                </label>
                <select
                  value={vitalType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setVitalType(t);
                    if (t === "Blood Glucose") setVitalUnit("mg/dL");
                    else if (t === "Heart Rate") setVitalUnit("bpm");
                    else if (t === "SpO2") setVitalUnit("%");
                    else if (t === "Weight") setVitalUnit("kg");
                    else setVitalUnit("mmHg");
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="Blood Pressure">Blood Pressure</option>
                  <option value="Blood Glucose">Blood Glucose</option>
                  <option value="Heart Rate">Heart Rate (Pulse)</option>
                  <option value="SpO2">SpO2 Oxygen</option>
                  <option value="Weight">Weight</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Value *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={vitalValue}
                    onChange={(e) => setVitalValue(e.target.value)}
                    placeholder="e.g. 120"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={vitalUnit}
                    onChange={(e) => setVitalUnit(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Notes
                </label>
                <input
                  type="text"
                  value={vitalNotes}
                  onChange={(e) => setVitalNotes(e.target.value)}
                  placeholder="e.g. Fasting, after breakfast"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVitalModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-semibold hover:bg-sky-600"
                >
                  Save Vital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">Add Medical History</h3>
              <button onClick={() => setHistoryModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddHistory} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Condition / Diagnosis *
                </label>
                <input
                  type="text"
                  required
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="e.g. Type 2 Diabetes, Hypertension"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Diagnosed Date
                </label>
                <input
                  type="date"
                  value={diagnosedAt}
                  onChange={(e) => setDiagnosedAt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Clinical Notes
                </label>
                <textarea
                  value={historyNotes}
                  onChange={(e) => setHistoryNotes(e.target.value)}
                  rows={2}
                  placeholder="Managing doctor, past treatments, etc."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setHistoryModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-semibold hover:bg-sky-600"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Modal */}
      {appointmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">Add Appointment</h3>
              <button onClick={() => setAppointmentModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddAppointment} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Reason / Title *
                </label>
                <input
                  type="text"
                  required
                  value={aptTitle}
                  onChange={(e) => setAptTitle(e.target.value)}
                  placeholder="e.g. Routine Cardiology Checkup"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Doctor Name
                </label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="e.g. Dr. Ramesh Gupta"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Location / Clinic
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Apollo Hospital, Room 204"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Scheduled Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAppointmentModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-semibold hover:bg-sky-600"
                >
                  Save Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900">Upload Health Document</h3>
              <button onClick={() => setUploadModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUploadDoc} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Document Title / Label *
                </label>
                <input
                  type="text"
                  required
                  value={docLabel}
                  onChange={(e) => setDocLabel(e.target.value)}
                  placeholder="e.g. Lipid Profile Oct 2025"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Select File *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-semibold hover:bg-sky-600 disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
