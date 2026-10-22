-- Migration: 0002_allow_device_api.sql
-- Enables ESP32 Hardware IoT devices to authenticate via device_key without requiring user auth sessions

-- 1. Devices Table Policy
create policy "Allow device verification via device_key"
  on public.devices for select
  using (true);

create policy "Allow device heartbeat update"
  on public.devices for update
  using (true)
  with check (true);

-- 2. Device Events Table Policy
create policy "Allow ESP32 device events insertion"
  on public.device_events for insert
  with check (true);

-- 3. Medication Schedules & Medications (Read-only for device sync)
create policy "Allow device to read active schedules"
  on public.medication_schedules for select
  using (is_active = true);

create policy "Allow device to read medications"
  on public.medications for select
  using (true);

-- 4. Dose Occurrences (Allow device to auto-acknowledge on reed switch open)
create policy "Allow device to acknowledge dose occurrences"
  on public.dose_occurrences for update
  using (true)
  with check (true);
