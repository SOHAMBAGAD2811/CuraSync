import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDeviceSupabaseClient } from "@/lib/supabase/device";
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
  getRateLimitHeaders,
  handleGeminiError,
  RATE_LIMIT_PROFILES,
} from "@/lib/ratelimit";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { message, userId } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    // 1. Enforce Gemini AI rate limiting per user / IP (15 requests / min)
    const clientIp = getClientIp(req);
    const rateLimitKey = userId || clientIp;
    const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMIT_PROFILES.GEMINI_AI);

    if (!rateLimit.success) {
      return createRateLimitResponse(
        rateLimit,
        `CuraBot message limit reached. Please wait ${rateLimit.retryAfterSec} seconds before sending another message.`
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 503 }
      );
    }

    // Fetch patient context from Supabase
    const { client: supabase } = await getDeviceSupabaseClient();

    let patientContext = "";
    let deviceKey = "";

    if (userId) {
      // Fetch medications
      const { data: medications } = await supabase
        .from("medications")
        .select("*, medication_schedules(*)")
        .eq("patient_id", userId)
        .eq("is_active", true);

      // Fetch today's doses
      const todayDate = new Date().toISOString().split("T")[0];
      const { data: doses } = await supabase
        .from("dose_occurrences")
        .select("*, medication_schedules(*, medications(*))")
        .eq("patient_id", userId)
        .gte("due_at", `${todayDate}T00:00:00Z`)
        .lte("due_at", `${todayDate}T23:59:59Z`)
        .order("due_at", { ascending: true });

      // Fetch device
      const { data: device } = await supabase
        .from("devices")
        .select("device_key, label, last_heartbeat_at")
        .eq("patient_id", userId)
        .maybeSingle();

      if (device?.device_key) deviceKey = device.device_key;

      // Build context
      const medList = medications?.map((m: {
        name: string;
        dosage: string | null;
        instructions: string | null;
        medication_schedules?: Array<{
          compartment_number: number;
          scheduled_time: string;
          days_of_week: number[];
        }>;
      }) => {
        const sched = m.medication_schedules?.[0];
        return `- ${m.name}${m.dosage ? ` (${m.dosage})` : ""} → Bay ${sched?.compartment_number || "?"} at ${sched?.scheduled_time?.slice(0, 5) || "?"} ${sched?.days_of_week?.length === 7 ? "daily" : "selected days"}${m.instructions ? ` | Note: ${m.instructions}` : ""}`;
      }).join("\n") || "No active medications";

      const doseStatus = doses?.map((d: {
        due_at: string;
        status: string;
        medication_schedules?: {
          compartment_number: number;
          medications?: { name: string } | null;
        } | null;
      }) => {
        const sched = d.medication_schedules;
        return `- Bay ${sched?.compartment_number || "?"}: ${sched?.medications?.name || "Med"} scheduled at ${d.due_at?.slice(11, 16)} → Status: ${d.status.toUpperCase()}`;
      }).join("\n") || "No doses scheduled for today";

      patientContext = `Current Medication Regimen:\n${medList}\n\nToday's Doses:\n${doseStatus}\n\nESP32 Dispenser Status: ${device ? `Active (${device.label || "CuraSync Dispenser"})` : "No device paired"}`;
    }

    // Queue an explicit bay alert directly. Calling this app's own HTTP route
    // through localhost breaks in deployments and adds a second timeout path.
    const alertIntent = /\b(trigger|ring|alert|buzz|sound)\b/i.test(message);
    const targetMatch = message.match(
      /\b(?:bay|compartment|box)\s*(?:number\s*)?(1|2|3|first|second|third|1st|2nd|3rd)\b|\b(1st|2nd|3rd|first|second|third)\s+(?:bay|compartment|box)\b/i
    );
    const targetText = targetMatch?.[1] || targetMatch?.[2];
    const bayNum = targetText
      ? ({ first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3 } as Record<string, number>)[targetText.toLowerCase()] || Number(targetText)
      : 0;

    if (alertIntent && bayNum >= 1 && bayNum <= 3 && deviceKey && userId) {
      const queuedMessage = {
        line1: "CURABOT ALERT",
        line2: `BAY ${bayNum} - TAKE MED`,
        ringBuzzer: true,
        durationSec: 10,
        compartment_number: bayNum,
      };
      const { error: queueError } = await supabase.from("notifications").insert({
        patient_id: userId,
        type: "general",
        title: queuedMessage.line1,
        body: JSON.stringify(queuedMessage),
        is_read: false,
      });

      if (queueError) {
        return NextResponse.json(
          { error: `Could not queue the Bay ${bayNum} alert: ${queueError.message}` },
          { status: 503 }
        );
      }

      // Return immediately instead of waiting for Gemini to generate an answer.
      return NextResponse.json(
        {
          success: true,
          reply: `Alert queued for Bay ${bayNum}. The dispenser will pick it up on its next heartbeat.`,
          deviceAction: `bay_alert_triggered:${bayNum}`,
        },
        { headers: getRateLimitHeaders(rateLimit) }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

    const systemPrompt = `You are CuraBot, CuraSync's friendly AI health assistant for an elderly patient's smart pill dispenser system. You have access to the patient's live medication data.

${patientContext}

Your capabilities:
1. Answer questions about medications, timing, adherence
2. Provide drug safety information (food interactions, side effects)
3. Help interpret adherence patterns
4. Trigger physical device alerts (when explicitly asked to "trigger alert on Bay X" or "ring Bay X")
5. Give encouragement and reminders

Guidelines:
- Be warm, simple, and patient-friendly (elderly users)
- Respond in 2-4 sentences max unless explaining something complex
- Always recommend consulting a doctor for medical decisions
- Use the patient's actual medication data in your answers
- If asked about interactions, give brief practical advice
- Do NOT diagnose or prescribe
- Format: plain text (no markdown headers, no bullet lists unless listing meds)`;

    const result = await model.generateContent(`${systemPrompt}\n\nUser asks: ${message}`);
    const reply = result.response.text().trim();

    return NextResponse.json(
      {
        success: true,
        reply,
        deviceAction: null,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error: unknown) {
    console.error("CuraBot error:", error);
    return handleGeminiError(error, "CuraBot encountered an error");
  }
}
