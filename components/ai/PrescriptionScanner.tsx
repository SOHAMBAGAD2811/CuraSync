"use client";

import { useState, useRef, useCallback } from "react";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Sparkles,
  Scan,
  Check,
  ChevronDown,
  ChevronUp,
  Pill,
  Clock,
  Hash,
} from "lucide-react";

interface ScannedMedicine {
  name: string;
  dosage: string;
  instructions: string;
  suggestedTime: string;
  frequency: string;
  suggestedDays: number[];
  suggestedCompartment: 1 | 2 | 3;
}

interface Props {
  onFillForm: (medicine: ScannedMedicine) => void;
  existingCompartments?: number[]; // already-used compartment numbers
}

const COMPARTMENT_COLORS: Record<number, string> = {
  1: "text-red-600 bg-red-50 border-red-200",
  2: "text-emerald-600 bg-emerald-50 border-emerald-200",
  3: "text-slate-600 bg-slate-100 border-slate-300",
};

export function PrescriptionScanner({ onFillForm, existingCompartments = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScannedMedicine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [cameraMode, setCameraMode] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraMode(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraMode(true);
    } catch {
      setError("Camera access denied. Please use file upload instead.");
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPreview(dataUrl);
    setMimeType("image/jpeg");
    stopCamera();
    setResults(null);
  }, [stopCamera]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
      setMimeType(file.type || "image/jpeg");
      setResults(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!preview) return;
    setScanning(true);
    setError(null);
    setResults(null);

    try {
      // Strip the data URL prefix to get raw base64
      const base64 = preview.split(",")[1];
      const res = await fetch("/api/ai/scan-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64, mimeType }),
      });

      const result = await res.json();

      if (!result.success) {
        setError(result.error || "Failed to scan image");
        return;
      }

      const parsed = result.data;
      if (parsed.error || !parsed.medicines || parsed.medicines.length === 0) {
        setError(parsed.error || "No medicine information detected in this image. Try a clearer photo.");
        return;
      }

      // Auto-assign compartments avoiding already-used ones
      let nextComp = 1;
      const assigned = parsed.medicines.map((m: ScannedMedicine) => {
        // Use AI suggestion if available and not used, else pick next free
        let comp = m.suggestedCompartment;
        if (existingCompartments.includes(comp)) {
          while (existingCompartments.includes(nextComp) && nextComp <= 3) nextComp++;
          comp = Math.min(nextComp, 3) as 1 | 2 | 3;
          nextComp++;
        }
        return { ...m, suggestedCompartment: comp };
      });

      setResults(assigned);
      setRawText(parsed.rawText || null);
      setConfidence(parsed.confidence || null);
      if (assigned.length === 1) setSelectedIdx(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scan failed. Check your connection.");
    } finally {
      setScanning(false);
    }
  };

  const handleFill = (idx: number) => {
    if (!results) return;
    onFillForm(results[idx]);
    setOpen(false);
    setPreview(null);
    setResults(null);
    setSelectedIdx(null);
  };

  const reset = () => {
    stopCamera();
    setPreview(null);
    setResults(null);
    setError(null);
    setRawText(null);
    setConfidence(null);
    setSelectedIdx(null);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        id="prescription-scanner-btn"
        onClick={() => setOpen(true)}
        type="button"
        className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-all shadow-md hover:shadow-lg cursor-pointer"
      >
        <Scan className="w-4 h-4" />
        <span>Scan Prescription</span>
        <span className="flex items-center gap-0.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5" />
          AI
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Scan className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-white">AI Prescription Scanner</h2>
                <p className="text-xs text-violet-200">Snap a photo of your prescription or medicine box</p>
              </div>
              <button
                type="button"
                onClick={() => { reset(); setOpen(false); }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Camera / Upload Area */}
              {!preview && !cameraMode && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 border-dashed border-violet-300 hover:border-violet-500 hover:bg-violet-50 transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-violet-100 group-hover:bg-violet-200 flex items-center justify-center transition-colors">
                      <Camera className="w-6 h-6 text-violet-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-800">Use Camera</p>
                      <p className="text-xs text-slate-500">Take live photo</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-12 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center transition-colors">
                      <Upload className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-800">Upload Image</p>
                      <p className="text-xs text-slate-500">From gallery or files</p>
                    </div>
                  </button>
                </div>
              )}

              {/* Camera Live View */}
              {cameraMode && (
                <div className="relative rounded-2xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    className="w-full rounded-2xl"
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-white/40 rounded-2xl pointer-events-none" />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="w-14 h-14 rounded-full bg-white border-4 border-violet-500 flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer"
                    >
                      <Camera className="w-6 h-6 text-violet-600" />
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center cursor-pointer self-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              {preview && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Prescription preview"
                    className="w-full max-h-48 object-contain bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={reset}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/70 flex items-center justify-center cursor-pointer hover:bg-slate-900 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Confidence badge */}
              {confidence && results && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">AI Confidence</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      confidence === "high"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : confidence === "medium"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    }`}
                  >
                    {confidence} confidence
                  </span>
                </div>
              )}

              {/* Scan Results */}
              {results && results.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {results.length} Medicine{results.length > 1 ? "s" : ""} Detected
                  </p>
                  {results.map((med, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedIdx(idx === selectedIdx ? null : idx)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all ${
                        selectedIdx === idx
                          ? "border-violet-400 bg-violet-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-violet-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Pill className="w-5 h-5 text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-slate-900 text-sm">{med.name}</h3>
                            {selectedIdx === idx ? (
                              <ChevronUp className="w-4 h-4 text-violet-500 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            )}
                          </div>
                          {med.dosage && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full mt-1">
                              <Hash className="w-3 h-3" />
                              {med.dosage}
                            </span>
                          )}
                          {selectedIdx === idx && (
                            <div className="mt-2.5 space-y-1.5">
                              {med.instructions && (
                                <p className="text-xs text-slate-600">📋 {med.instructions}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className="flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full font-medium">
                                  <Clock className="w-3 h-3" />
                                  {med.suggestedTime}
                                </span>
                                <span className="text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                                  {med.frequency}
                                </span>
                                <span
                                  className={`text-xs border px-2 py-0.5 rounded-full font-semibold ${COMPARTMENT_COLORS[med.suggestedCompartment]}`}
                                >
                                  Bay {med.suggestedCompartment}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedIdx === idx && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleFill(idx); }}
                          className="mt-3 w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          Use this — Auto-fill Form
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Scan / Re-scan Buttons */}
              {preview && !scanning && (
                <div className="flex gap-2">
                  {results ? (
                    <button
                      type="button"
                      onClick={handleScan}
                      className="flex-1 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                      Re-scan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleScan}
                      disabled={scanning}
                      className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      Scan with Gemini AI
                    </button>
                  )}
                </div>
              )}

              {scanning && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-violet-600 animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-700">Analyzing prescription...</p>
                    <p className="text-xs text-slate-400 mt-0.5">Gemini Vision AI is reading your image</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}
    </>
  );
}
