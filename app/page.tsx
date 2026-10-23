"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Cpu,
  Clock,
  ShieldCheck,
  Users,
  Bell,
  HeartPulse,
  Activity,
  CheckCircle2,
  ArrowRight,
  Wifi,
  Sparkles,
  Radio,
  Pill,
} from "lucide-react";
import { Dispenser3DCanvas } from "@/components/dashboard/Dispenser3DCanvas";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50/20 to-white text-slate-900 flex flex-col font-sans">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="CuraSync"
              width={120}
              height={36}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-sky-600 transition-colors">
              Features
            </a>
            <a href="#hardware" className="hover:text-sky-600 transition-colors">
              IoT Hardware
            </a>
            <a href="#how-it-works" className="hover:text-sky-600 transition-colors">
              How It Works
            </a>
            <a href="#caregivers" className="hover:text-sky-600 transition-colors">
              Caregiver Portal
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-bold text-slate-700 hover:text-sky-600 px-3.5 py-2 rounded-xl transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-bold bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white px-4 sm:px-5 py-2.5 rounded-xl shadow-xs transition-all active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold border border-sky-200">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>Next-Generation IoT Medicine Adherence Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.12]">
              Smart Medication Management Meets{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-teal-600">
                Connected Hardware
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              CuraSync bridges a physical 3-compartment ESP32 reminder device with
              a real-time cloud wellness dashboard — guaranteeing on-time doses,
              family caregiver visibility, and emergency SOS coordination.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white font-bold text-sm sm:text-base shadow-md shadow-sky-600/20 transition-all active:scale-95"
              >
                <span>Create Free Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm sm:text-base border border-slate-200 shadow-xs transition-all active:scale-95"
              >
                <span>Live Dashboard Demo</span>
              </Link>
            </div>
          </div>

          {/* Interactive 3D Model Hero Showcase */}
          <div className="mt-12 max-w-4xl mx-auto rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                <span className="ml-2 text-xs font-bold text-slate-600">
                  ESP32 Smart Dispenser Unit (Interactive 3D Preview)
                </span>
              </div>
              <span className="text-xs text-sky-700 font-semibold bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-100">
                Drag to rotate &bull; Click lids
              </span>
            </div>

            <div className="p-4 sm:p-6 bg-gradient-to-b from-sky-50/30 to-white">
              <Dispenser3DCanvas pendingCompartment={1} />
            </div>

            <div className="px-6 py-3 bg-slate-900 text-emerald-300 font-mono text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>[RTC 08:00:00] COMPARTMENT 1 DUE &bull; RED LED PULSING</span>
              </div>
              <span className="text-slate-400 text-[11px]">
                Reed Switches GPIO 32, 33, 25 &bull; Buzzer GPIO 26
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Features Section */}
      <section id="features" className="py-16 md:py-24 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-sky-700 uppercase">
              End-to-End Patient Care
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Everything you need for worry-free medication
            </h3>
            <p className="text-sm sm:text-base text-slate-600">
              Engineered specifically for elderly patients, chronic health conditions, and coordinating caregivers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl p-6 bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                <Pill className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Multi-Color LED Guidance
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Color-coded LEDs (Red for C1, Green for C2, White for C3) illuminate to guide patients to the exact compartment without guesswork.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl p-6 bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Offline-First RTC Precision
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Powered by a high-precision DS3231 RTC chip. Alarms and buzzers activate locally on schedule even during Wi-Fi or router outages.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl p-6 bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                <Activity className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Automated Dose Logging
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Physical reed switch sensors automatically record dose acknowledgement the instant a compartment lid is opened.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl p-6 bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Caregiver Visibility & SOS
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Family members receive real-time notifications for missed doses and emergency SOS broadcasts with granular permission control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Hardware Details Section */}
      <section id="hardware" className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200">
                <Cpu className="w-3.5 h-3.5 text-teal-600" />
                <span>Embedded IoT Architecture</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Physical ESP32 Bedside Dispenser Unit
              </h2>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                The CuraSync device runs on lightweight, robust C++ firmware. It syncs scheduled timetables with the Supabase cloud backend via RESTful endpoints, while preserving full local offline autonomy.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">Compartment 1</h5>
                    <p className="text-xs text-slate-500">Red LED on GPIO 18 &bull; Reed Magnetic Sensor on GPIO 32</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">Compartment 2</h5>
                    <p className="text-xs text-slate-500">Green LED on GPIO 19 &bull; Reed Magnetic Sensor on GPIO 33</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-600 mt-1.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">Compartment 3</h5>
                    <p className="text-xs text-slate-500">White LED on GPIO 23 &bull; Reed Magnetic Sensor on GPIO 25</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                  <Radio className="w-4 h-4 text-sky-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h5 className="text-sm font-bold text-slate-900">Peripherals & Screen</h5>
                    <p className="text-xs text-slate-500">1602 I2C Backlit LCD (0x27) &bull; Passive Piezo Buzzer on GPIO 26 &bull; DS3231 RTC on I2C</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Code / API Blueprint Card */}
            <div className="rounded-3xl bg-slate-900 p-6 sm:p-8 text-white shadow-xl border border-slate-800 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-mono text-sky-400">firmware_sync_flow.cpp</span>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  RESTful HTTPS Sync
                </span>
              </div>

              <pre className="text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
{`// 1. Fetch Cloud Schedule
HTTPClient http;
http.begin(client, SERVER_URL + "/api/device/schedule");
int code = http.GET(); // Updates alarmHour[3]

// 2. Local Alarm & LED Activation
if (rtc.now().hour() == alarmHour[0]) {
  digitalWrite(ledPin_Red, HIGH); // C1 Glows
  startBuzzer(0);
}

// 3. Reed Switch Auto-Acknowledgement (Lid Lifted -> GPIO HIGH)
if (digitalRead(reedPin_C1) == HIGH) {
  reportCompartmentOpen(1); // Auto marks dose taken
  stopBuzzer();
  digitalWrite(ledPin_Red, LOW);
}`}
              </pre>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Supports ESP32 WROOM-32 & NodeMCU</span>
                <Link
                  href="/device"
                  className="text-sky-400 font-bold hover:underline"
                >
                  View Device Bench &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How It Works Section */}
      <section id="how-it-works" className="py-16 md:py-24 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-sky-700 uppercase">
              Simple 3-Step Workflow
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              How CuraSync Works in Practice
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 font-black text-xl flex items-center justify-center mx-auto border border-sky-200">
                1
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Assign & Schedule
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Input your prescription and map it to Compartment 1, 2, or 3 with customized intake times and meal instructions.
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 text-teal-700 font-black text-xl flex items-center justify-center mx-auto border border-teal-200">
                2
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Visual & Audio Cue
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                When dose time arrives, the passive buzzer beeps and the designated Red, Green, or White LED pulses on the physical unit.
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 font-black text-xl flex items-center justify-center mx-auto border border-emerald-200">
                3
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                Instant Automatic Sync
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Opening the lid immediately acknowledges the dose in the cloud, silences the buzzer, and records compliance in your weekly report.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Call To Action Footer Banner */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready for Worry-Free Health & Medication Tracking?
          </h2>
          <p className="text-sky-100 text-base max-w-xl mx-auto">
            Get started with CuraSync today — connect your physical reminder unit, maintain vital health records, and keep family informed.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/signup"
              className="px-8 py-3.5 rounded-2xl bg-white text-sky-900 font-extrabold text-sm sm:text-base shadow-lg hover:bg-slate-50 transition-all active:scale-95"
            >
              Get Started Now
            </Link>
            <Link
              href="/login"
              className="px-7 py-3.5 rounded-2xl bg-sky-700/60 hover:bg-sky-700 text-white font-bold text-sm sm:text-base border border-white/20 transition-all active:scale-95"
            >
              Sign In to Account
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="CuraSync"
              width={100}
              height={30}
              className="h-7 w-auto object-contain"
            />
            <span>&bull; &copy; 2026 CuraSync. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6 font-medium text-slate-600">
            <Link href="/login" className="hover:text-sky-600">
              Dashboard
            </Link>
            <Link href="/device" className="hover:text-sky-600">
              Hardware Bench
            </Link>
            <a href="https://curasync-iot.vercel.app" className="hover:text-sky-600">
              curasync-iot.vercel.app
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
