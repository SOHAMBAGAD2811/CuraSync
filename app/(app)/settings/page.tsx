"use client";

import { useEffect, useState } from "react";
import { User, Globe, Clock, Bell, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

export default function SettingsPage() {
  const { user, profile, settings, refresh } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [graceMinutes, setGraceMinutes] = useState(60);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
    if (settings) {
      setTimezone(settings.timezone || "Asia/Kolkata");
      setGraceMinutes(settings.missed_dose_grace_minutes || 60);
    }
  }, [profile, settings]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);

    await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    await refresh();
    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2500);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingSettings(true);

    await supabase
      .from("patient_settings")
      .upsert({
        patient_id: user.id,
        timezone,
        missed_dose_grace_minutes: graceMinutes,
        updated_at: new Date().toISOString(),
      })
      .select();

    await refresh();
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Patient profile, regional timekeeping, and adherence parameters
        </p>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Personal Information
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Phone Number
            </label>
            <input
              type="tel"
              placeholder="+91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Profile
            </button>
            {profileSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Preferences & Grace Period Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Adherence & Timekeeping
          </h2>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
            </select>
            <p className="text-[11px] text-slate-400">
              Used for synchronization with the ESP32 DS3231 RTC module.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Missed-Dose Grace Period (Minutes)
            </label>
            <input
              type="number"
              min={10}
              max={240}
              value={graceMinutes}
              onChange={(e) => setGraceMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            <p className="text-[11px] text-slate-400">
              If a dose is not taken within this window after its due time, it will automatically transition to missed.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-60 flex items-center gap-1.5"
            >
              {savingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Preferences
            </button>
            {settingsSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <Check className="w-3.5 h-3.5" /> Preferences Saved!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-sky-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Notifications
          </h2>
        </div>
        <div className="space-y-3 text-xs">
          {[
            "Dose Due audio/visual alerts",
            "Late dose warnings",
            "Missed dose notifications to Caregiver",
            "SOS Emergency broadcasts",
          ].map((label) => (
            <label key={label} className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-700">{label}</span>
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 accent-sky-500 rounded"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
