import { createClient } from "@/lib/supabase/client";
import type { Database, DoseStatus } from "@/lib/types/database";

type DoseOccurrence = Database["public"]["Tables"]["dose_occurrences"]["Row"];

const lastSyncCache = new Map<string, number>();

/**
 * Ensure today's dose occurrences exist for all active medication schedules
 */
export async function syncTodayDoseOccurrences(patientId: string, force = false) {
  const nowMs = Date.now();
  const lastSync = lastSyncCache.get(patientId) || 0;
  // Rate limit client dose syncs to at most once every 10 seconds per patient
  if (!force && nowMs - lastSync < 10000) {
    return;
  }
  lastSyncCache.set(patientId, nowMs);

  const supabase = createClient();

  // 1. Fetch active schedules
  const { data: schedules, error: schedErr } = await supabase
    .from("medication_schedules")
    .select("*, medications(*)")
    .eq("patient_id", patientId)
    .eq("is_active", true);

  if (schedErr || !schedules) return;

  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  // 2. Fetch existing dose occurrences for today
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const { data: existingDoses } = await supabase
    .from("dose_occurrences")
    .select("schedule_id, due_at")
    .eq("patient_id", patientId)
    .gte("due_at", startOfDay)
    .lte("due_at", endOfDay);

  const existingMap = new Set(
    (existingDoses || []).map((d) => `${d.schedule_id}_${d.due_at}`)
  );

  const dosesToInsert: Database["public"]["Tables"]["dose_occurrences"]["Insert"][] = [];

  for (const sched of schedules) {
    if (!sched.days_of_week.includes(currentDayOfWeek)) {
      continue;
    }

    // Format scheduled_time (HH:MM or HH:MM:SS) into ISO due_at for today
    const timeParts = sched.scheduled_time.split(":");
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);

    const dueDate = new Date(now);
    dueDate.setHours(hours, minutes, 0, 0);
    const dueAtISO = dueDate.toISOString();

    const key = `${sched.id}_${dueAtISO}`;
    if (!existingMap.has(key)) {
      // Determine initial status based on due time vs current time + grace period
      let initialStatus: DoseStatus = "scheduled";
      if (dueDate < now) {
        initialStatus = "pending";
      }

      dosesToInsert.push({
        patient_id: patientId,
        schedule_id: sched.id,
        due_at: dueAtISO,
        status: initialStatus,
      });
    }
  }

  if (dosesToInsert.length > 0) {
    await supabase.from("dose_occurrences").insert(dosesToInsert);
  }
}

/**
 * Mark a dose as acknowledged (taken), determining whether it was on-time or late.
 */
export async function acknowledgeDose(
  doseId: string,
  graceMinutes: number = 60
) {
  const supabase = createClient();
  const now = new Date();

  // Fetch the dose
  const { data: dose, error } = await supabase
    .from("dose_occurrences")
    .select("*")
    .eq("id", doseId)
    .single();

  if (error || !dose) return { error: error || new Error("Dose not found") };

  const dueTime = new Date(dose.due_at).getTime();
  const currentTime = now.getTime();
  const diffMinutes = (currentTime - dueTime) / (1000 * 60);

  let status: DoseStatus = "acknowledged";
  if (diffMinutes > 15) {
    // Acknowledged more than 15 mins after scheduled time
    status = "late";
  }

  const { data: updated, error: updateErr } = await supabase
    .from("dose_occurrences")
    .update({
      status,
      acknowledged_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", doseId)
    .select()
    .single();

  return { data: updated, error: updateErr };
}
