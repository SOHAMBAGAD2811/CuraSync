import { NextRequest, NextResponse } from "next/server";
import { getDeviceSupabaseClient } from "@/lib/supabase/device";
import { deviceMessages } from "@/lib/device-messages";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const deviceKey = req.headers.get("x-device-key") || body.device_key;

    if (!deviceKey) {
      return NextResponse.json(
        { error: "Missing x-device-key header or device_key in payload" },
        { status: 401 }
      );
    }

    const { client: supabase } = await getDeviceSupabaseClient();

    // 1. Verify device exists
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

    const now = new Date().toISOString();

    // 2. Update last heartbeat timestamp
    await supabase
      .from("devices")
      .update({ last_heartbeat_at: now })
      .eq("id", device.id);

    // 3. Record device event
    await supabase.from("device_events").insert({
      device_id: device.id,
      patient_id: device.patient_id,
      event_type: "heartbeat",
      compartment_number: null,
      event_time: now,
      raw_payload: body,
    });

    // 4. Retrieve any queued LCD message or buzzer trigger from frontend
    const queuedMessage = deviceMessages.get(deviceKey);
    if (queuedMessage) {
      // Delete once fetched so it doesn't repeatedly re-trigger
      deviceMessages.delete(deviceKey);
    }

    return NextResponse.json({
      success: true,
      timestamp: now,
      message: "Heartbeat acknowledged",
      custom_msg: queuedMessage
        ? {
            line1: queuedMessage.line1,
            line2: queuedMessage.line2,
            ring_buzzer: queuedMessage.ringBuzzer,
            duration_sec: queuedMessage.durationSec,
          }
        : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
