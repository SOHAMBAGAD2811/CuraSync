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
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // 1. Enforce Gemini Adherence rate limiting per user / IP (8 requests / min)
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(userId || clientIp, RATE_LIMIT_PROFILES.GEMINI_ADHERENCE);

    if (!rateLimit.success) {
      return createRateLimitResponse(
        rateLimit,
        `Adherence insights report limit reached. Please wait ${rateLimit.retryAfterSec} seconds before refreshing.`
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 503 }
      );
    }

    const { client: supabase } = await getDeviceSupabaseClient();

    // Fetch last 30 days of dose occurrences
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: doses } = await supabase
      .from("dose_occurrences")
      .select("*, medication_schedules(compartment_number, scheduled_time, medications(name))")
      .eq("patient_id", userId)
      .gte("due_at", thirtyDaysAgo.toISOString())
      .order("due_at", { ascending: true });

    // Fetch device events (compartment opens)
    const { data: deviceEvents } = await supabase
      .from("device_events")
      .select("*")
      .eq("patient_id", userId)
      .gte("event_time", thirtyDaysAgo.toISOString())
      .order("event_time", { ascending: true });

    // Calculate adherence statistics
    type DoseRow = NonNullable<typeof doses>[number];
    const totalDoses = doses?.length || 0;
    const takenDoses = doses?.filter((d: DoseRow) => d.status === "acknowledged").length || 0;
    const missedDoses = doses?.filter((d: DoseRow) => d.status === "missed").length || 0;
    const lateDoses = doses?.filter((d: DoseRow) => d.status === "late").length || 0;
    const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;

    // Day-of-week analysis
    const dayStats: Record<number, { total: number; taken: number; avgDelay: number; delays: number[] }> = {};
    for (let i = 0; i < 7; i++) {
      dayStats[i] = { total: 0, taken: 0, avgDelay: 0, delays: [] };
    }

    doses?.forEach((d: DoseRow) => {
      const dayOfWeek = new Date(d.due_at).getDay();
      dayStats[dayOfWeek].total++;
      if (d.status === "acknowledged") {
        dayStats[dayOfWeek].taken++;
        if (d.acknowledged_at) {
          const delayMs = new Date(d.acknowledged_at).getTime() - new Date(d.due_at).getTime();
          const delayMin = Math.round(delayMs / 60000);
          if (delayMin >= 0 && delayMin < 240) {
            dayStats[dayOfWeek].delays.push(delayMin);
          }
        }
      }
    });

    // Compute avg delay per day
    Object.keys(dayStats).forEach((day) => {
      const ds = dayStats[parseInt(day)];
      if (ds.delays.length > 0) {
        ds.avgDelay = Math.round(ds.delays.reduce((a, b) => a + b, 0) / ds.delays.length);
      }
    });

    // Bay-level stats
    const bayStats: Record<number, { total: number; taken: number; avgDelay: number; delays: number[] }> = {
      1: { total: 0, taken: 0, avgDelay: 0, delays: [] },
      2: { total: 0, taken: 0, avgDelay: 0, delays: [] },
      3: { total: 0, taken: 0, avgDelay: 0, delays: [] },
    };

    doses?.forEach((d: DoseRow) => {
      const sched = d.medication_schedules as any;
      const bay = sched?.compartment_number;
      if (bay && bayStats[bay]) {
        bayStats[bay].total++;
        if (d.status === "acknowledged") {
          bayStats[bay].taken++;
          if (d.acknowledged_at) {
            const delayMs = new Date(d.acknowledged_at).getTime() - new Date(d.due_at).getTime();
            const delayMin = Math.round(delayMs / 60000);
            if (delayMin >= 0 && delayMin < 240) {
              bayStats[bay].delays.push(delayMin);
            }
          }
        }
      }
    });

    Object.keys(bayStats).forEach((bay) => {
      const bs = bayStats[parseInt(bay)];
      if (bs.delays.length > 0) {
        bs.avgDelay = Math.round(bs.delays.reduce((a, b) => a + b, 0) / bs.delays.length);
      }
    });

    const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const statsContext = `
Adherence summary (last 30 days):
- Total doses: ${totalDoses}
- Taken: ${takenDoses} (${adherenceRate}%)
- Missed: ${missedDoses}
- Late: ${lateDoses}

Day-of-week breakdown:
${Object.entries(dayStats).map(([day, stats]) => {
  const rate = stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0;
  return `${DAY_NAMES[parseInt(day)]}: ${rate}% adherence, avg delay ${stats.avgDelay} min`;
}).join("\n")}

Bay performance:
${Object.entries(bayStats).map(([bay, stats]) => {
  const rate = stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0;
  return `Bay ${bay}: ${rate}% taken, avg delay ${stats.avgDelay} min`;
}).join("\n")}

Device events: ${deviceEvents?.length || 0} total (last 30 days)
`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are CuraSync's Predictive Adherence AI. Analyze this patient's medication adherence data and generate actionable insights.

${statsContext}

Return ONLY a valid JSON object (no markdown):
{
  "riskScore": 85,
  "riskLevel": "low/moderate/high",
  "riskLabel": "Short human-readable risk label (e.g. '82% delay risk on Fridays')",
  "weeklyBrief": "Natural language 2-3 sentence caregiver brief about adherence patterns",
  "insights": [
    {
      "type": "pattern/warning/recommendation",
      "icon": "📊",
      "title": "Short title",
      "description": "Detailed insight in 1-2 sentences"
    }
  ],
  "recommendations": [
    {
      "bay": 1,
      "currentTime": "20:00",
      "suggestedTime": "20:30",
      "reason": "Evening doses delayed by avg 38 min"
    }
  ],
  "dayRisks": {
    "0": 20,
    "1": 15,
    "2": 25,
    "3": 30,
    "4": 45,
    "5": 80,
    "6": 60
  }
}

Notes:
- riskScore: 0-100 (100 = perfect adherence, 0 = never takes meds)
- dayRisks: risk percentage for each day (0=Sun, 6=Sat), higher = more likely to miss/delay
- insights: 3-5 insights based on actual data patterns
- recommendations: only include if avg delay > 15 minutes for a bay
- weeklyBrief: write as if addressing the caregiver, mention patient by "the patient"
- If not enough data (< 5 doses), return appropriate low-data response`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    let parsed;
    try {
      const clean = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // Return computed stats even if AI fails
      return NextResponse.json({
        success: true,
        data: {
          riskScore: adherenceRate,
          riskLevel: adherenceRate >= 80 ? "low" : adherenceRate >= 60 ? "moderate" : "high",
          riskLabel: `${adherenceRate}% overall adherence`,
          weeklyBrief: `The patient took ${takenDoses} out of ${totalDoses} doses (${adherenceRate}%) in the last 30 days.`,
          insights: [],
          recommendations: [],
          dayRisks: Object.fromEntries(Object.entries(dayStats).map(([day, stats]) => {
            const rate = stats.total > 0 ? Math.round(((stats.total - stats.taken) / stats.total) * 100) : 0;
            return [day, rate];
          })),
        },
        stats: { totalDoses, takenDoses, missedDoses, lateDoses, adherenceRate, dayStats, bayStats },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: parsed,
        stats: { totalDoses, takenDoses, missedDoses, lateDoses, adherenceRate, dayStats, bayStats },
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (error: any) {
    console.error("Adherence insights error:", error);
    return handleGeminiError(error, "Failed to generate adherence insights");
  }
}
