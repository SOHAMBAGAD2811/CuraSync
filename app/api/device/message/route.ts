import { NextRequest, NextResponse } from "next/server";
import { deviceMessages } from "@/lib/device-messages";
import { getDeviceSupabaseClient } from "@/lib/supabase/device";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { device_key, line1, line2, ring_buzzer, duration_sec } = body;

    if (!device_key) {
      const { client: supabase } = await getDeviceSupabaseClient();
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes?.user) {
        const { data: dev } = await supabase
          .from("devices")
          .select("device_key")
          .eq("patient_id", userRes.user.id)
          .maybeSingle();
        if (dev?.device_key) {
          device_key = dev.device_key;
        }
      }
    }

    if (!device_key) {
      return NextResponse.json(
        { error: "Missing required parameter: device_key" },
        { status: 400 }
      );
    }

    const trimmedLine1 = (line1 || "").slice(0, 16);
    const trimmedLine2 = (line2 || "").slice(0, 16);

    const messageData = {
      line1: trimmedLine1,
      line2: trimmedLine2,
      ringBuzzer: Boolean(ring_buzzer),
      durationSec: duration_sec || 15,
      timestamp: new Date().toISOString(),
    };

    deviceMessages.set(device_key, messageData);

    return NextResponse.json({
      success: true,
      message: "Message queued for ESP32 LCD display",
      data: messageData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to queue message" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceKey = searchParams.get("device_key") || searchParams.get("key");

  if (!deviceKey) {
    return NextResponse.json({ error: "Missing device_key parameter" }, { status: 400 });
  }

  const message = deviceMessages.get(deviceKey);
  return NextResponse.json({
    success: true,
    has_message: Boolean(message),
    message: message || null,
  });
}
