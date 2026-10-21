import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceKey =
      req.headers.get("x-device-key") || searchParams.get("key");

    if (!deviceKey) {
      return NextResponse.json(
        { error: "Unauthorized: Missing device key" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // 1. Verify device
    const { data: device, error } = await supabase
      .from("devices")
      .select("*")
      .eq("device_key", deviceKey)
      .maybeSingle();

    if (error || !device) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid device key" },
        { status: 401 }
      );
    }

    // 2. Fetch active medication schedules
    const { data: schedules, error: schedError } = await supabase
      .from("medication_schedules")
      .select("*, medications(*)")
      .eq("patient_id", device.patient_id)
      .eq("is_active", true)
      .order("scheduled_time", { ascending: true });

    if (schedError) {
      return NextResponse.json({ error: schedError.message }, { status: 500 });
    }

    // 3. Format response specifically for ESP32 firmware
    // Flattened alarms array for easy parsing in Arduino C++
    const alarms = [1, 2, 3].map((compNum) => {
      const match = (schedules || []).find(
        (s) => s.compartment_number === compNum
      );
      if (match) {
        const parts = match.scheduled_time.split(":");
        const med = match.medications as unknown as { name: string } | null;
        return {
          compartment: compNum,
          hour: parseInt(parts[0], 10),
          minute: parseInt(parts[1], 10),
          active: true,
          name: med?.name || "Medication",
        };
      }
      return {
        compartment: compNum,
        hour: -1,
        minute: -1,
        active: false,
        name: "Empty",
      };
    });

    const compartments = [1, 2, 3].map((compNum) => {
      const compSchedules = (schedules || []).filter(
        (s) => s.compartment_number === compNum
      );
      return {
        compartment: compNum,
        schedules: compSchedules.map((s) => {
          const med = s.medications as unknown as {
            name: string;
            dosage: string | null;
          } | null;
          return {
            schedule_id: s.id,
            medicine_name: med?.name || "Medication",
            dosage: med?.dosage || "",
            scheduled_time: s.scheduled_time, // e.g. "08:00:00"
            days_of_week: s.days_of_week,
          };
        }),
      };
    });

    return NextResponse.json({
      success: true,
      patient_id: device.patient_id,
      sync_time: new Date().toISOString(),
      alarms,
      compartments,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
