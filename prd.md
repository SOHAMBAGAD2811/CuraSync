# CuraSync — Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Initial Development  
**Product Type:** IoT-Enabled Medicine Reminder and Patient Wellness Platform  
**Target Platforms:** Web and Android PWA

---

## 1. Product Overview

### 1.1 Product Description

CuraSync is an IoT-enabled medicine adherence and patient wellness platform designed to help patients manage medication schedules, track missed and late doses, maintain personal health records, and communicate with caregivers.

The system combines a web-based dashboard, a Supabase backend, and an ESP32-powered medicine reminder device. The physical device uses reed switches to detect compartment openings, LEDs to indicate pending doses, an LCD to display system information, a passive buzzer for reminders, and an RTC module for timekeeping.

CuraSync will provide patients and caregivers with a centralized interface for monitoring medication activity, reviewing weekly reports, managing health information, and recording emergency SOS events.

### 1.2 Problem Statement

Patients may forget scheduled medicines, take them late, or have difficulty maintaining a consistent medication routine. Caregivers may also lack visibility into medication adherence and changes in the patient's health records.

CuraSync aims to address these challenges through scheduled reminders, physical compartment monitoring, adherence reports, patient health records, and caregiver access with configurable permissions.

### 1.3 Product Vision

To develop a reliable, accessible, and extensible medicine management platform that combines physical reminders, digital health records, and caregiver coordination in one application.

---

## 2. Product Objectives

The primary objectives are:

1. Provide configurable medicine schedules and reminders.
2. Track scheduled, acknowledged, late, and missed doses.
3. Integrate the existing ESP32 medicine reminder hardware.
4. Provide visual medication adherence reports and weekly statistics.
5. Allow patients to maintain vital signs, medical history, blood reports, and appointments.
6. Enable patients to share selected information with caregivers.
7. Provide an SOS event mechanism for emergency-related communication.
8. Deliver an installable, responsive application using Progressive Web App (PWA) technology.
9. Protect patient information through authentication, authorization, and secure storage.

## 3. Target Users

### 3.1 Patient

The patient is the primary application user and owner of their health information.

Responsibilities and capabilities:

- Manage medicines and schedules.
- View upcoming and pending doses.
- Review medication adherence reports.
- Record vital signs and upload medical documents.
- Maintain medical history and appointments.
- Configure missed-dose grace periods.
- Invite caregivers and manage their permissions.
- Create SOS events.

### 3.2 Caregiver or Family Member

The caregiver supports the patient and receives authorized information.

Capabilities depend on the permissions granted by the patient:

- View medication schedules and status.
- View medication reports.
- Access permitted health records.
- Receive relevant alerts.
- View and acknowledge SOS events.
- Manage medicines or health records only when explicitly authorized.

### 3.3 ESP32 Device

The ESP32 is the physical medicine reminder controller.

Responsibilities:

- Maintain local medication reminder timing.
- Activate the corresponding LED and buzzer.
- Read reed switch states.
- Display time and pending-dose information on the LCD.
- Synchronize with the backend when network connectivity is available.
- Report device status and compartment events.

The initial deployment supports one patient and one ESP32 device with three compartments.

---

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js App Router |
| Programming language | TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Charts | Recharts |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Backend operations | Supabase Edge Functions |
| File storage | Supabase Storage |
| Live updates | Supabase Realtime |
| Hardware | ESP32 |
| Hardware timekeeping | DS3231 RTC |
| Source control | GitHub |
| Web deployment | Vercel |
| Mobile distribution | Installable Android PWA |

The initial application will use a responsive web architecture. Capacitor may be introduced later if native Android functionality becomes necessary.

---

## 5. Functional Requirements

### 5.1 Authentication and User Management

**FR-01:** Users shall be able to register and log in securely.

**FR-02:** Each authenticated user shall have a profile.

**FR-03:** Patients shall be able to invite caregivers.

**FR-04:** Caregiver invitations shall require acceptance before access is activated.

**FR-05:** Patients shall be able to revoke caregiver access.

**FR-06:** Caregiver permissions shall be configurable by the patient.

**FR-07:** Unauthorized users shall not be able to access patient information.

### 5.2 Dashboard

**FR-08:** The dashboard shall display the current day's medication schedule.

**FR-09:** It shall display upcoming, pending, acknowledged, late, and missed doses.

**FR-10:** It shall provide a summary of weekly adherence.

**FR-11:** It shall display the next scheduled dose.

**FR-12:** It shall display the ESP32 device's reported connection status.

**FR-13:** It shall display the status of the three medicine compartments when device data is available.

### 5.3 Medicine Management

**FR-14:** Patients shall be able to add, edit, deactivate, and manage medicine records.

**FR-15:** Each medicine shall include a name, dosage, instructions, and applicable start and end dates.

**FR-16:** Patients shall be able to configure recurring medication schedules.

**FR-17:** Each physical compartment shall be assigned a compartment number from 1 to 3.

**FR-18:** The application shall support different medication times throughout the day.

**FR-19:** Schedule changes shall be stored in Supabase and made available to the ESP32 through authenticated backend operations.

### 5.4 Dose Tracking

**FR-20:** The system shall create a record for each scheduled dose occurrence.

**FR-21:** Each dose occurrence shall have a due time and a defined status.

**FR-22:** The system shall distinguish compartment-opening events from confirmed medicine consumption.

**FR-23:** Acknowledged doses shall retain their actual acknowledgement timestamps.

**FR-24:** Doses acknowledged after their scheduled time but before the configured deadline shall be classified as late.

**FR-25:** Unacknowledged doses shall be classified as missed after the patient's configured grace period expires.

**FR-26:** The application shall preserve dose history for reporting.

**FR-27:** Duplicate device events shall not create duplicate dose acknowledgements.

### 5.5 Weekly Reports and Analytics

**FR-28:** The reports page shall provide weekly medication activity summaries.

**FR-29:** Reports shall include taken or acknowledged, late, and missed dose counts.

**FR-30:** The application shall display daily and weekly charts.

**FR-31:** The application shall calculate adherence percentages from recorded dose occurrences.

**FR-32:** Users shall be able to review individual missed and late doses.

**FR-33:** Report calculations shall use consistent status definitions and the patient's configured timezone.

### 5.6 Patient Health Records

**FR-34:** Patients shall be able to enter vital signs manually.

**FR-35:** Vital-sign records shall include a measurement type, value, unit, and timestamp.

**FR-36:** Patients shall be able to upload blood reports and other medical documents.

**FR-37:** Uploaded documents shall be stored privately.

**FR-38:** Patients shall be able to maintain medical history entries.

**FR-39:** Patients shall be able to create and manage appointment records.

**FR-40:** Caregivers shall only access health information permitted by the patient.

The application shall present health records as stored information and shall not claim to provide medical diagnoses.

### 5.7 Alerts and SOS

**FR-41:** The system shall maintain records of dose-related alerts.

**FR-42:** It shall support alerts for due, late, and missed doses.

**FR-43:** Patients shall be able to create SOS events.

**FR-44:** SOS events shall record their creation time, status, and associated patient.

**FR-45:** Authorized caregivers shall be able to view relevant SOS events.

**FR-46:** SOS notification delivery shall be added in a later phase.

**FR-47:** The application shall not claim that an SOS has been delivered or acknowledged unless the corresponding event has been confirmed.

### 5.8 Device Management

**FR-48:** Each patient shall have one registered ESP32 device in the initial release.

**FR-49:** Device requests shall be authenticated independently of frontend access.

**FR-50:** The backend shall record device heartbeats and event timestamps.

**FR-51:** The dashboard shall display online or offline status based on recent device communication.

**FR-52:** Device events shall identify the associated compartment when applicable.

**FR-53:** The system shall support local reminders when Wi-Fi is unavailable.

**FR-54:** Device reconnection shall synchronize required schedule and status information.

**FR-55:** The backend shall reject unauthorized device requests.

---

## 6. Frontend Pages and Navigation

The application shall use a modern, light-themed medical dashboard with responsive layouts.

| Page | Route | Purpose |
|---|---|---|
| Login | `/login` | User authentication |
| Registration | `/signup` | Account creation |
| Dashboard | `/dashboard` | Overview of medication activity |
| Medicines | `/medicines` | Medicine management |
| Schedule | `/schedule` | Daily and weekly medication timetable |
| Reports | `/reports` | Adherence charts and dose history |
| Alerts | `/alerts` | Dose notifications and SOS history |
| Health Records | `/health` | Vitals, documents, and medical history |
| Device | `/device` | ESP32 status and compartment events |
| Caregiver | `/caregiver` | Invitations and permission management |
| Settings | `/settings` | Profile, timezone, and preferences |

The dashboard shall prioritize the next dose, pending doses, adherence statistics, and device connectivity.

On mobile devices, navigation shall adapt to a compact layout suitable for installation as a PWA.

---

## 7. Database Requirements

The database shall use Supabase PostgreSQL with foreign keys, constraints, indexes, and Row Level Security.

### 7.1 Proposed Tables

| Table | Purpose |
|---|---|
| `profiles` | User profile information |
| `patient_settings` | Timezone and missed-dose grace period |
| `caregiver_links` | Patient-caregiver relationships and permissions |
| `devices` | Registered ESP32 device information |
| `medications` | Medicine details |
| `medication_schedules` | Recurring dose schedules and compartment assignments |
| `dose_occurrences` | Individual scheduled dose records |
| `device_events` | Sensor events, heartbeats, and device activity |
| `notifications` | Notification records and delivery status |
| `sos_alerts` | SOS events and resolution status |
| `vital_signs` | Manually entered health measurements |
| `medical_documents` | Metadata for uploaded medical documents |
| `medical_history` | Patient medical history |
| `appointments` | Appointment records |

### 7.2 Data Integrity Requirements

- Each patient shall have no more than one registered device in the initial release.
- Compartment numbers shall be restricted to 1, 2, and 3.
- Each scheduled dose occurrence shall be unique for its schedule and due time.
- Dose records shall preserve timestamps and status changes.
- Medical documents shall reference private storage paths.
- Caregiver permissions shall be validated before granting access.
- Foreign keys shall maintain valid relationships between records.
- Indexes shall support queries by patient, due time, status, and event timestamp.

### 7.3 Security Requirements

- Enable RLS on all exposed tables.
- Use Supabase Auth for user identity.
- Apply patient ownership and caregiver permission checks.
- Keep service-role keys and device credentials out of browser code.
- Validate device requests through trusted backend operations.
- Store health documents in a private Storage bucket.
- Validate document types and file sizes.
- Prevent unauthorized modification of dose history and SOS records.

The initial SQL migration shall be reviewed and tested before production use.

---

## 8. System Architecture

The system shall consist of four primary layers.

### 8.1 Frontend Layer

Next.js shall provide the responsive dashboard, authentication screens, forms, charts, and PWA functionality.

### 8.2 Backend Layer

Supabase Edge Functions shall handle privileged operations, including device authentication, schedule synchronization, event ingestion, dose-state transitions, and SOS processing.

### 8.3 Database Layer

Supabase PostgreSQL shall store users, medication schedules, dose occurrences, device events, health records, and notifications.

### 8.4 Hardware Layer

The ESP32 shall retain local control of the RTC, reed switches, LEDs, LCD, and passive buzzer. Cloud synchronization shall supplement rather than replace local reminder functionality.

---

## 9. Non-Functional Requirements

### 9.1 Reliability

- Local reminders shall continue during internet outages.
- The system shall tolerate temporary backend unavailability.
- Device events shall be processed idempotently to avoid duplicate records.
- Missed-dose calculations shall use consistent server-side rules.

### 9.2 Security and Privacy

- Patient records shall be accessible only to authorized users.
- Caregiver permissions shall be enforced by database policies.
- Medical documents shall not be publicly accessible.
- Credentials shall be stored securely.
- Sensitive data shall be transmitted over HTTPS in production.

### 9.3 Usability

- The interface shall be responsive on desktop, tablet, and mobile.
- Important dose statuses shall be easy to distinguish.
- Controls shall use clear labels and accessible contrast.
- Forms shall validate user input and provide understandable error messages.

### 9.4 Maintainability

- Frontend components, database operations, and backend logic shall be separated.
- TypeScript shall be used for application code.
- Database schema changes shall be version-controlled through migrations.
- Hardware communication shall use documented API contracts.

### 9.5 Performance

- Dashboard queries shall be indexed appropriately.
- Reports shall aggregate dose records efficiently.
- Large medical documents shall be stored outside PostgreSQL in Supabase Storage.
- Live updates shall be limited to relevant records.

---

## 10. PWA Requirements

The application shall support installation on compatible Android devices through the browser.

Requirements include:

- A valid web app manifest.
- Application name, icons, theme color, and display configuration.
- Responsive mobile screens.
- HTTPS deployment.
- Appropriate service-worker and caching behaviour.
- A clear offline experience that does not display stale data as current.

PWA installation shall not be treated as equivalent to guaranteed background execution or guaranteed notification delivery. Native Android packaging may be considered later if required.

---

## 11. Implementation Roadmap

### Phase 1 — Project Foundation

- Initialize the Next.js App Router project.
- Configure TypeScript and Tailwind CSS.
- Establish the project folder structure.
- Configure Supabase clients and environment variables.

### Phase 2 — UI Development

- Implement the dashboard layout.
- Build medicine and schedule screens.
- Add report charts using sample data.
- Create health record, device, caregiver, and settings screens.

### Phase 3 — Database and Authentication

- Create and validate the initial SQL migration.
- Configure authentication.
- Implement RLS policies.
- Test patient and caregiver permissions.
- Configure private medical document storage.

### Phase 4 — Medication Management

- Implement medicine CRUD operations.
- Create recurring schedules.
- Generate dose occurrences.
- Implement late and missed-dose rules.
- Build weekly adherence reports.

### Phase 5 — Patient and Caregiver Features

- Implement caregiver invitations and permissions.
- Add manual vital-sign entry.
- Add document uploads, medical history, and appointments.
- Implement SOS event creation and viewing.

### Phase 6 — ESP32 Integration

- Register the device securely.
- Implement authenticated schedule retrieval.
- Report heartbeats and compartment events.
- Synchronize dose acknowledgements.
- Test Wi-Fi disconnection and recovery.

### Phase 7 — PWA and Deployment

- Configure PWA installation.
- Deploy the application to Vercel.
- Configure production environment variables.
- Test on Android and desktop.
- Verify database security and the end-to-end hardware workflow.

---

## 12. Acceptance Criteria

The initial release will be considered ready for testing when:

1. A patient can register, log in, and manage their profile.
2. A patient can add medicines and create schedules for three compartments.
3. The system generates distinct dose occurrences for scheduled doses.
4. Late and missed doses are calculated using the patient's configured grace period.
5. Weekly reports display consistent counts and adherence percentages.
6. Patients can enter vital signs and upload private medical documents.
7. A patient can invite a caregiver and configure permissions.
8. Unauthorized users cannot access protected patient records.
9. The ESP32 can retrieve schedules and report compartment events through authenticated endpoints.
10. Local ESP32 reminders continue when Wi-Fi is disconnected.
11. SOS events are recorded and visible to authorized users.
12. The web application can be installed and used as a PWA on a compatible Android device.
13. Production deployment passes authentication, authorization, and device-integration tests.

---

## 13. Out of Scope for the Initial Release

The following are deferred unless explicitly added to the scope:

- Automatic integration with hospital or laboratory systems.
- Automatic vital-sign collection from medical devices.
- Automated medical diagnosis or treatment recommendations.
- Multiple ESP32 devices per patient.
- Native Android application packaging.
- SMS, email, and push-notification delivery for SOS.
- Direct emergency-service integration.
- Automatic proof that medicine was swallowed.
- Advanced predictive analytics.

---

## 14. Key Assumptions and Risks

**Assumptions**

- The existing ESP32 hardware and local reminder code are functional.
- The patient and caregiver have internet access when using the web application.
- The patient manually enters health measurements and uploads reports.
- The RTC and local firmware maintain scheduled reminders independently of the cloud.

**Risks and mitigations**

- **Incorrect sensor interpretation:** Validate reed-switch polarity and compartment-opening events before using them in adherence calculations.
- **Duplicate device events:** Use unique event identifiers and idempotent backend processing.
- **Network outages:** Preserve local scheduling and reminders on the ESP32.
- **Unauthorized health-data access:** Test RLS, caregiver permissions, and private Storage policies.
- **Missed-dose misclassification:** Use a patient-configurable grace period and server-side time-based transitions.
- **Unreliable SOS delivery:** Treat SOS as a recorded event until a real notification channel is integrated and verified.

---

## 15. Success Metrics

Initial success will be evaluated using:

- Percentage of scheduled doses with recorded outcomes.
- Number and proportion of late and missed doses.
- Successful synchronization of device events.
- Device online availability.
- Accuracy of weekly report calculations.
- Successful caregiver permission enforcement.
- Successful PWA installation and usability on Android.
- Successful end-to-end tests of medicine scheduling and compartment acknowledgement.

**Product outcome:** CuraSync will provide a unified system for medication reminders, adherence reporting, patient health records, caregiver coordination, and ESP32-based compartment monitoring, with security and offline reliability built into the architecture from the beginning.
