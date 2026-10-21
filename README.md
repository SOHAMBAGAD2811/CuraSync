# CuraSync

**IoT-Enabled Medicine Reminder and Patient Wellness Platform**

CuraSync is an end-to-end healthcare platform designed to improve medication adherence, bridge patient-caregiver coordination, and integrate with physical 3-compartment smart medicine reminder hardware powered by ESP32.

---

## 🌟 Key Features

### 💊 Medication & Schedule Management
- **3-Compartment Pill Organizer Mapping**: Assign specific prescriptions to physical compartments (1, 2, or 3).
- **Flexible Timetables**: Configure daily, weekly, or specific day recurring schedules with custom timings (e.g. 08:00 AM, 01:00 PM, 08:00 PM).
- **Automated Dose Tracking**: Daily dose occurrences are automatically generated and classified in real-time as `scheduled`, `pending`, `acknowledged` (on-time), `late`, or `missed`.
- **Configurable Grace Periods**: Patient-defined grace windows (e.g. 60 minutes) before an unacknowledged dose transitions to `missed`.

### 📊 Adherence Analytics & Reports
- **Weekly Adherence Rates**: Visual bar charts powered by Recharts comparing taken, late, and missed doses over time.
- **Dose History**: Complete audit trail preserving timestamps when doses were due versus when physical compartments were opened.

### 🩺 Patient Health Records
- **Vital Signs**: Log Blood Pressure, Blood Glucose, Heart Rate, SpO2, and Weight measurements with historical timeline tracking.
- **Medical History**: Record chronic conditions, diagnoses, and physician notes.
- **Doctor Appointments**: Schedule and manage upcoming consultations and follow-ups.
- **Lab Documents**: Upload and manage prescriptions, blood test reports, and scans.

### 👥 Caregiver Coordination & Granular Permissions
- **Family / Caregiver Invitations**: Connect caregivers to monitor patient well-being.
- **Granular Access Control**: Toggle specific permissions:
  - View Schedules
  - View Adherence Reports
  - View Vital Signs & Health Records
  - View Emergency SOS Events
  - Manage Medicines & Prescriptions

### 🚨 Emergency SOS System
- **One-Click SOS**: Instant emergency signal broadcast.
- **Caregiver Alerts**: Active SOS alarms with symptom descriptions and resolution tracking.

### 🔌 ESP32 Hardware Reminder Integration
- **Physical Device**: Supports ESP32 with DS3231 RTC, 3 reed switches (magnetic compartment sensors), passive buzzer, LEDs, and 1602 LCD.
- **Offline Reliability**: Local RTC and firmware logic ensure scheduled buzzers and LED reminders fire on time even during home Wi-Fi or internet outages.
- **Automatic Cloud Sync**: Once Wi-Fi reconnects, compartment-opening events synchronize with the cloud backend to mark doses taken.
- **Embedded Test Console**: Includes an in-browser Hardware Simulator to test heartbeats and compartment sensor events without needing the physical board connected.

### 📱 Progressive Web App (PWA)
- Fully responsive light-theme medical dashboard.
- Installable on Android and desktop devices with full web app manifest support.

---

## 🏗️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [Next.js 16 (App Router)](https://nextjs.org) |
| **Language** | [TypeScript](https://www.typescriptlang.org) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) |
| **Routing & Auth Proxy** | Next.js 16 `proxy.ts` |
| **Icons** | [Lucide React](https://lucide.dev) |
| **Data Visualization** | [Recharts](https://recharts.org) |
| **Database & Auth** | [Supabase](https://supabase.com) (PostgreSQL with RLS) |
| **Client Session SSR** | `@supabase/ssr` & `@supabase/supabase-js` |
| **Hardware** | ESP32 + DS3231 RTC + Reed Switches + Buzzer + 1602 LCD |

---

## 📁 Project Structure

```
curasync/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # User sign-in
│   │   └── signup/page.tsx         # User registration
│   ├── (app)/
│   │   ├── layout.tsx              # App shell (desktop sidebar + mobile drawer)
│   │   ├── dashboard/page.tsx      # Main dashboard with stats & compartment status
│   │   ├── medicines/page.tsx      # Medicine CRUD & compartment assignments
│   │   ├── schedule/page.tsx       # Weekly matrix & daily timetable
│   │   ├── reports/page.tsx        # 7-day adherence charts & missed dose details
│   │   ├── alerts/page.tsx         # Notification center & Emergency SOS
│   │   ├── health/page.tsx         # Vitals, medical history, documents, appointments
│   │   ├── device/page.tsx         # ESP32 hardware status & simulator bench
│   │   ├── caregiver/page.tsx      # Caregiver invitations & permission matrix
│   │   └── settings/page.tsx       # Profile, timezone & grace period settings
│   ├── api/
│   │   └── device/
│   │       ├── heartbeat/route.ts  # Device heartbeat endpoint
│   │       ├── schedule/route.ts   # Device schedule sync endpoint
│   │       └── event/route.ts      # Device compartment open/close ingestion
│   ├── globals.css                 # Tailwind CSS styles
│   ├── layout.tsx                  # Root layout with metadata & AuthProvider
│   └── page.tsx                    # Route redirect to /dashboard
├── components/
│   ├── dashboard/                  # Dashboard widgets & charts
│   ├── layout/                     # Sidebar & Mobile Navigation
│   ├── providers/                  # React AuthProvider & User Context
│   └── ui/                         # Reusable UI primitives
├── lib/
│   ├── doses.ts                    # Dose generation & adherence calculation logic
│   ├── supabase/                   # Supabase browser, server, and proxy clients
│   └── types/                      # Comprehensive TypeScript database definitions
├── public/
│   ├── icons/                      # PWA icons (192x192, 512x512)
│   └── manifest.json               # Web App Manifest
├── supabase/
│   └── migrations/                 # Full PostgreSQL schema with RLS policies
├── proxy.ts                        # Next.js 16 request proxy for auth protection
└── prd.md                          # Product Requirements Document
```

---

## 🗄️ Database Architecture

The PostgreSQL schema contains 14 tables secured with Row Level Security (RLS):

- `profiles` — User account details.
- `patient_settings` — Timezone and missed-dose grace minutes.
- `caregiver_links` — Patient-caregiver relationships with JSONB permission flags.
- `devices` — Registered ESP32 devices and unique device keys.
- `medications` — Active and archived prescriptions.
- `medication_schedules` — Timetable mapped to compartments 1, 2, or 3.
- `dose_occurrences` — Individual due doses and acknowledgement states.
- `device_events` — Sensor activations, reed switch logs, and heartbeats.
- `notifications` — Real-time dose alerts and system notices.
- `sos_alerts` — Emergency SOS events and resolution status.
- `vital_signs` — Blood pressure, glucose, heart rate, SpO2, and weight logs.
- `medical_documents` — Uploaded medical document metadata.
- `medical_history` — Diagnosed chronic conditions and allergies.
- `appointments` — Doctor consultations and follow-ups.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18.18.0 or newer)
- npm, pnpm, or yarn
- A [Supabase](https://supabase.com) project

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/curasync.git
cd curasync
npm install
```

### 2. Configure Environment Variables

Create `.env.local` by copying `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Database Migrations

Copy the SQL migration from [`supabase/migrations/0001_curasync_initial_schema.sql`](supabase/migrations/0001_curasync_initial_schema.sql) and execute it in your **Supabase Dashboard > SQL Editor**.

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access CuraSync.

---

## 🛠️ ESP32 Hardware Integration

### Endpoints for Firmware

All device endpoints authenticate using the unique `device_key` displayed on the **Device** page:

1. **Heartbeat Sync**:
   ```http
   POST /api/device/heartbeat
   Headers: { "x-device-key": "your-device-key" }
   Body: { "status": "OK" }
   ```

2. **Retrieve Schedules**:
   ```http
   GET /api/device/schedule
   Headers: { "x-device-key": "your-device-key" }
   ```
   *Returns the active alarm times and medicine details for compartments 1, 2, and 3.*

3. **Compartment Sensor Event (Reed Switch Triggered)**:
   ```http
   POST /api/device/event
   Headers: { "x-device-key": "your-device-key" }
   Body: {
     "event_type": "compartment_open",
     "compartment_number": 1
   }
   ```
   *Automatically matches any scheduled dose for that compartment today and marks it `acknowledged` or `late`.*

---

## 🧪 Production Build

To verify and generate an optimized production bundle:

```bash
npm run build
npm start
```

---

## 📄 License

This project is licensed under the MIT License.
