import { NextRequest, NextResponse } from "next/server";
import { deviceMessages } from "@/lib/device-messages";
import { getDeviceSupabaseClient } from "@/lib/supabase/device";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let device_key = body.device_key;
    const { line1, line2, ring_buzzer, duration_sec, compartment_number } = body;

    const { client: supabase } = await getDeviceSupabaseClient();

    if (!device_key) {
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes?.user) {
        const { data: dev } = await supabase
          .from("devices")
          .select("device_key, patient_id")
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
    const targetCompartment = [1, 2, 3].includes(Number(compartment_number))
      ? (Number(compartment_number) as 1 | 2 | 3)
      : undefined;

    const messageData = {
      line1: trimmedLine1,
      line2: trimmedLine2,
      ringBuzzer: Boolean(ring_buzzer),
      durationSec: duration_sec || 15,
      timestamp: new Date().toISOString(),
      compartmentNumber: targetCompartment,
    };

    // 1. In-memory queue
    deviceMessages.set(device_key, messageData);

    // 2. Persistent Supabase DB queue (accessible across all serverless Vercel lambdas & local)
    try {
      const { data: dev } = await supabase
        .from("devices")
        .select("patient_id")
        .eq("device_key", device_key)
        .maybeSingle();

      if (dev?.patient_id) {
        await supabase.from("notifications").insert({
          patient_id: dev.patient_id,
          type: "general",
          title: trimmedLine1 || "LCD Remote Alert",
          body: JSON.stringify(messageData),
          is_read: false,
        });
      }
    } catch (dbErr) {
      console.warn("Could not persist message to notifications table:", dbErr);
    }

    return NextResponse.json({
      success: true,
      message: "Message queued for ESP32 LCD display",
      data: messageData,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to queue message" },
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
