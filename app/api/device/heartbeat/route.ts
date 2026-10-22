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

    // 4. Retrieve any queued LCD message or buzzer trigger
    let queuedMsg: {
      line1: string;
      line2: string;
      ring_buzzer: boolean;
      duration_sec: number;
    } | null = null;

    // Check persistent database queue first (works across Vercel serverless & local)
    try {
      const { data: dbNotif } = await supabase
        .from("notifications")
        .select("*")
        .eq("patient_id", device.patient_id)
        .eq("type", "general")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbNotif && dbNotif.body) {
        try {
          const parsed = typeof dbNotif.body === "string" ? JSON.parse(dbNotif.body) : dbNotif.body;
          queuedMsg = {
            line1: (parsed.line1 || dbNotif.title || "").slice(0, 16),
            line2: (parsed.line2 || "").slice(0, 16),
            ring_buzzer: Boolean(parsed.ringBuzzer ?? parsed.ring_buzzer),
            duration_sec: parsed.durationSec || parsed.duration_sec || 15,
          };
          // Mark as processed in database
          await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", dbNotif.id);
        } catch {}
      }
    } catch {}

    // Fallback to in-memory store
    if (!queuedMsg) {
      const memMsg = deviceMessages.get(deviceKey);
      if (memMsg) {
        deviceMessages.delete(deviceKey);
        queuedMsg = {
          line1: memMsg.line1,
          line2: memMsg.line2,
          ring_buzzer: memMsg.ringBuzzer,
          duration_sec: memMsg.durationSec,
        };
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now,
      message: "Heartbeat acknowledged",
      custom_msg: queuedMsg,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
