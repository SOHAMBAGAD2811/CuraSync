import { NextRequest, NextResponse } from "next/server";
import { getDeviceSupabaseClient } from "@/lib/supabase/device";
import type { CompartmentNumber } from "@/lib/types/database";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceKey = req.headers.get("x-device-key") || body.device_key;
    const eventType = body.event_type as "compartment_open" | "compartment_close" | "heartbeat";
    const compartmentNumber = body.compartment_number as CompartmentNumber | undefined;

    if (!deviceKey) {
      return NextResponse.json(
        { error: "Unauthorized: Missing device key" },
        { status: 401 }
      );
    }

    const { client: supabase } = await getDeviceSupabaseClient();

    // 1. Verify device
    const { data: device, error } = await supabase
      .from("devices")
      .select("*")
      .eq("device_key", deviceKey)
      .maybeSingle();

    if (error || !device) {
      return NextResponse.json(
        {
          error: "Unauthorized: Invalid device key",
          hint: error?.message || "Check device key or configure valid SUPABASE_SERVICE_ROLE_KEY",
        },
        { status: 401 }
      );
    }

    const now = new Date();
    const nowISO = now.toISOString();

    // Updating the heartbeat and recording the event are independent writes.
    const [heartbeatUpdate, eventInsert] = await Promise.all([
      supabase
        .from("devices")
        .update({ last_heartbeat_at: nowISO })
        .eq("id", device.id),
      supabase.from("device_events").insert({
        device_id: device.id,
        patient_id: device.patient_id,
        event_type: eventType || "compartment_open",
        compartment_number: compartmentNumber || null,
        event_time: nowISO,
        raw_payload: body,
      }),
    ]);
    if (heartbeatUpdate.error) {
      console.error("Failed to update device heartbeat:", heartbeatUpdate.error.message);
    }

    const eventInsertError = eventInsert.error;
    if (eventInsertError) {
      return NextResponse.json(
        { error: `Failed to record device event: ${eventInsertError.message}` },
        { status: 500 }
      );
    }

    let doseAcknowledged = false;
    let doseId: string | null = null;

    // 4. If compartment opened, match with due dose occurrence for today
    if (eventType === "compartment_open" && compartmentNumber) {
      const todayDate = nowISO.split("T")[0];
      const startOfDay = `${todayDate}T00:00:00.000Z`;
      const endOfDay = `${todayDate}T23:59:59.999Z`;

      // Find active schedules for this compartment
      const { data: schedules } = await supabase
        .from("medication_schedules")
        .select("id")
        .eq("patient_id", device.patient_id)
        .eq("compartment_number", compartmentNumber)
        .eq("is_active", true);

      if (schedules && schedules.length > 0) {
        const scheduleIds = (schedules as { id: string }[]).map(({ id }) => id);

        // Find earliest pending or scheduled dose occurrence for today
        const { data: pendingDoses } = await supabase
          .from("dose_occurrences")
          .select("*")
          .eq("patient_id", device.patient_id)
          .in("schedule_id", scheduleIds)
          .in("status", ["scheduled", "pending"])
          .gte("due_at", startOfDay)
          .lte("due_at", endOfDay)
          .order("due_at", { ascending: true })
          .limit(1);

        if (pendingDoses && pendingDoses.length > 0) {
          const targetDose = pendingDoses[0];
          const dueTime = new Date(targetDose.due_at).getTime();
          const diffMinutes = (now.getTime() - dueTime) / (1000 * 60);

          const newStatus = diffMinutes > 15 ? "late" : "acknowledged";

          await supabase
            .from("dose_occurrences")
            .update({
              status: newStatus,
              acknowledged_at: nowISO,
              updated_at: nowISO,
            })
            .eq("id", targetDose.id);

          doseAcknowledged = true;
          doseId = targetDose.id;
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: nowISO,
      event_recorded: true,
      dose_acknowledged: doseAcknowledged,
      dose_id: doseId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
