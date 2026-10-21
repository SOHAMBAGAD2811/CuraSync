-- CuraSync Initial Schema
-- Run this in your Supabase SQL editor or via supabase db push

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────
-- PATIENT SETTINGS
-- ─────────────────────────────────────────────────────────────────
create table public.patient_settings (
  id                          uuid primary key default uuid_generate_v4(),
  patient_id                  uuid not null references public.profiles(id) on delete cascade unique,
  timezone                    text not null default 'UTC',
  missed_dose_grace_minutes   int  not null default 60 check (missed_dose_grace_minutes >= 0),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table public.patient_settings enable row level security;

create policy "Patients can manage their own settings"
  on public.patient_settings for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- CAREGIVER LINKS
-- ─────────────────────────────────────────────────────────────────
create table public.caregiver_links (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references public.profiles(id) on delete cascade,
  caregiver_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  permissions   jsonb not null default '{}',
  invited_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  updated_at    timestamptz not null default now(),
  unique (patient_id, caregiver_id)
);

create index idx_caregiver_links_patient    on public.caregiver_links(patient_id);
create index idx_caregiver_links_caregiver  on public.caregiver_links(caregiver_id);

alter table public.caregiver_links enable row level security;

create policy "Patients can manage caregiver links they own"
  on public.caregiver_links for all
  using (auth.uid() = patient_id);

create policy "Caregivers can view their own links"
  on public.caregiver_links for select
  using (auth.uid() = caregiver_id);

create policy "Caregivers can accept their own pending invitations"
  on public.caregiver_links for update
  using (auth.uid() = caregiver_id and status = 'pending');

-- ─────────────────────────────────────────────────────────────────
-- DEVICES
-- ─────────────────────────────────────────────────────────────────
create table public.devices (
  id                  uuid primary key default uuid_generate_v4(),
  patient_id          uuid not null references public.profiles(id) on delete cascade unique,
  device_key          text not null unique, -- hashed secret used by ESP32
  label               text,
  last_heartbeat_at   timestamptz,
  created_at          timestamptz not null default now()
);

alter table public.devices enable row level security;

create policy "Patients can manage their own device"
  on public.devices for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- MEDICATIONS
-- ─────────────────────────────────────────────────────────────────
create table public.medications (
  id           uuid primary key default uuid_generate_v4(),
  patient_id   uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  dosage       text,
  instructions text,
  start_date   date not null,
  end_date     date,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_medications_patient on public.medications(patient_id);

alter table public.medications enable row level security;

create policy "Patients can manage their own medications"
  on public.medications for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- MEDICATION SCHEDULES
-- ─────────────────────────────────────────────────────────────────
create table public.medication_schedules (
  id                  uuid primary key default uuid_generate_v4(),
  medication_id       uuid not null references public.medications(id) on delete cascade,
  patient_id          uuid not null references public.profiles(id) on delete cascade,
  compartment_number  int  not null check (compartment_number in (1, 2, 3)),
  scheduled_time      time not null,          -- local time (interpreted in patient timezone)
  days_of_week        int[] not null,         -- 0=Sun … 6=Sat
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_schedules_patient    on public.medication_schedules(patient_id);
create index idx_schedules_medication on public.medication_schedules(medication_id);

alter table public.medication_schedules enable row level security;

create policy "Patients can manage their own schedules"
  on public.medication_schedules for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- DOSE OCCURRENCES
-- ─────────────────────────────────────────────────────────────────
create table public.dose_occurrences (
  id              uuid primary key default uuid_generate_v4(),
  schedule_id     uuid not null references public.medication_schedules(id) on delete cascade,
  patient_id      uuid not null references public.profiles(id) on delete cascade,
  due_at          timestamptz not null,
  status          text not null default 'scheduled'
                    check (status in ('scheduled', 'pending', 'acknowledged', 'late', 'missed')),
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (schedule_id, due_at)  -- prevents duplicate occurrences
);

create index idx_doses_patient   on public.dose_occurrences(patient_id);
create index idx_doses_due_at    on public.dose_occurrences(due_at);
create index idx_doses_status    on public.dose_occurrences(status);

alter table public.dose_occurrences enable row level security;

create policy "Patients can view and update their own dose records"
  on public.dose_occurrences for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- DEVICE EVENTS
-- ─────────────────────────────────────────────────────────────────
create table public.device_events (
  id                  uuid primary key default uuid_generate_v4(),
  device_id           uuid not null references public.devices(id) on delete cascade,
  patient_id          uuid not null references public.profiles(id) on delete cascade,
  event_type          text not null check (event_type in ('heartbeat', 'compartment_open', 'compartment_close')),
  compartment_number  int  check (compartment_number in (1, 2, 3)),
  event_time          timestamptz not null,
  raw_payload         jsonb,
  created_at          timestamptz not null default now()
);

create index idx_device_events_patient    on public.device_events(patient_id);
create index idx_device_events_event_time on public.device_events(event_time);

alter table public.device_events enable row level security;

create policy "Patients can view their own device events"
  on public.device_events for select
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────────
create table public.notifications (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in ('dose_due', 'dose_late', 'dose_missed', 'sos', 'general')),
  title         text not null,
  body          text,
  is_read       boolean not null default false,
  reference_id  uuid,
  created_at    timestamptz not null default now()
);

create index idx_notifications_patient on public.notifications(patient_id);
create index idx_notifications_read    on public.notifications(patient_id, is_read);

alter table public.notifications enable row level security;

create policy "Patients can view and update their own notifications"
  on public.notifications for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- SOS ALERTS
-- ─────────────────────────────────────────────────────────────────
create table public.sos_alerts (
  id           uuid primary key default uuid_generate_v4(),
  patient_id   uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'active' check (status in ('active', 'acknowledged', 'resolved')),
  notes        text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create index idx_sos_patient on public.sos_alerts(patient_id);

alter table public.sos_alerts enable row level security;

create policy "Patients can create and view their own SOS alerts"
  on public.sos_alerts for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- VITAL SIGNS
-- ─────────────────────────────────────────────────────────────────
create table public.vital_signs (
  id           uuid primary key default uuid_generate_v4(),
  patient_id   uuid not null references public.profiles(id) on delete cascade,
  type         text not null,   -- e.g. 'blood_pressure', 'heart_rate', 'glucose'
  value        numeric not null,
  unit         text not null,
  measured_at  timestamptz not null,
  notes        text,
  created_at   timestamptz not null default now()
);

create index idx_vitals_patient     on public.vital_signs(patient_id);
create index idx_vitals_measured_at on public.vital_signs(measured_at);

alter table public.vital_signs enable row level security;

create policy "Patients can manage their own vital signs"
  on public.vital_signs for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- MEDICAL DOCUMENTS
-- ─────────────────────────────────────────────────────────────────
create table public.medical_documents (
  id                uuid primary key default uuid_generate_v4(),
  patient_id        uuid not null references public.profiles(id) on delete cascade,
  label             text not null,
  storage_path      text not null,   -- path in Supabase Storage private bucket
  file_type         text,
  file_size_bytes   bigint,
  uploaded_at       timestamptz not null default now()
);

create index idx_medical_docs_patient on public.medical_documents(patient_id);

alter table public.medical_documents enable row level security;

create policy "Patients can manage their own medical documents"
  on public.medical_documents for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- MEDICAL HISTORY
-- ─────────────────────────────────────────────────────────────────
create table public.medical_history (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references public.profiles(id) on delete cascade,
  condition     text not null,
  diagnosed_at  date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index idx_medical_history_patient on public.medical_history(patient_id);

alter table public.medical_history enable row level security;

create policy "Patients can manage their own medical history"
  on public.medical_history for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────────────────────────────────────────
create table public.appointments (
  id            uuid primary key default uuid_generate_v4(),
  patient_id    uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  doctor_name   text,
  location      text,
  scheduled_at  timestamptz not null,
  notes         text,
  created_at    timestamptz not null default now()
);

create index idx_appointments_patient      on public.appointments(patient_id);
create index idx_appointments_scheduled_at on public.appointments(scheduled_at);

alter table public.appointments enable row level security;

create policy "Patients can manage their own appointments"
  on public.appointments for all
  using (auth.uid() = patient_id);

-- ─────────────────────────────────────────────────────────────────
-- CAREGIVER READ POLICIES (based on permissions jsonb)
-- ─────────────────────────────────────────────────────────────────

-- Helper: check if a caregiver has a specific permission for a patient
create or replace function public.caregiver_has_permission(
  p_patient_id uuid,
  p_permission text
)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.caregiver_links
    where caregiver_id = auth.uid()
      and patient_id   = p_patient_id
      and status       = 'active'
      and (permissions->>'viewAll')::boolean = true
        or (permissions->>p_permission)::boolean = true
  );
$$;

-- Caregiver: view schedules
create policy "Caregivers can view patient schedules with permission"
  on public.medication_schedules for select
  using (public.caregiver_has_permission(patient_id, 'viewSchedule'));

-- Caregiver: view dose occurrences (for reports)
create policy "Caregivers can view dose occurrences with permission"
  on public.dose_occurrences for select
  using (public.caregiver_has_permission(patient_id, 'viewReports'));

-- Caregiver: view SOS
create policy "Caregivers can view SOS alerts with permission"
  on public.sos_alerts for select
  using (public.caregiver_has_permission(patient_id, 'viewSOS'));

-- Caregiver: view vital signs
create policy "Caregivers can view vital signs with permission"
  on public.vital_signs for select
  using (public.caregiver_has_permission(patient_id, 'viewHealthRecords'));

-- Caregiver: view medical history
create policy "Caregivers can view medical history with permission"
  on public.medical_history for select
  using (public.caregiver_has_permission(patient_id, 'viewHealthRecords'));

-- Caregiver: view appointments
create policy "Caregivers can view appointments with permission"
  on public.appointments for select
  using (public.caregiver_has_permission(patient_id, 'viewHealthRecords'));
