import { NextRequest, NextResponse } from "next/server";
import { getDeviceSupabaseClient } from "@/lib/supabase/device";

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
    // Current time in IST (India Standard Time UTC+5:30)
    const nowUtc = new Date();
    const istTime = new Date(nowUtc.getTime() + 5.5 * 3600 * 1000);
    const currTotalMinutes = istTime.getUTCHours() * 60 + istTime.getUTCMinutes();

    // Flattened alarms array: picks the NEXT UPCOMING dose today (or loops to tomorrow's earliest)
    const alarms = [1, 2, 3].map((compNum) => {
      const compScheds = ((schedules as any[]) || []).filter(
        (s: any) => s.compartment_number === compNum
      );
      if (compScheds.length === 0) {
        return {
          compartment: compNum,
          hour: -1,
          minute: -1,
          active: false,
          name: "Empty",
        };
      }

      const parsed = compScheds.map((s: any) => {
        const parts = s.scheduled_time.split(":");
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const med = s.medications as unknown as { name: string } | null;
        return {
          hour: h,
          minute: m,
          totalMin: h * 60 + m,
          name: med?.name || "Medication",
        };
      }).sort((a, b) => a.totalMin - b.totalMin);

      // Pick next upcoming dose today (or loop to first dose tomorrow)
      const chosen = parsed.find((p) => p.totalMin >= currTotalMinutes) || parsed[0];

      return {
        compartment: compNum,
        hour: chosen.hour,
        minute: chosen.minute,
        active: true,
        name: chosen.name,
      };
    });

    // Flat list of ALL active alarms across all compartments
    const all_alarms = ((schedules as any[]) || []).map((s: any) => {
      const parts = s.scheduled_time.split(":");
      const med = s.medications as unknown as { name: string } | null;
      return {
        compartment: s.compartment_number,
        hour: parseInt(parts[0], 10),
        minute: parseInt(parts[1], 10),
        active: true,
        name: med?.name || "Medication",
      };
    });

    const compartments = [1, 2, 3].map((compNum) => {
      const compSchedules = ((schedules as any[]) || []).filter(
        (s: any) => s.compartment_number === compNum
      );
      return {
        compartment: compNum,
        schedules: compSchedules.map((s: any) => {
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
      all_alarms,
      compartments,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
