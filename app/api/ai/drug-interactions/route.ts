import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const { medicines } = await req.json();

    if (!medicines || medicines.length === 0) {
      return NextResponse.json({ interactions: [], safe: true });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 503 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    const medList = medicines
      .map((m: any, i: number) => `Bay ${m.compartment || i + 1}: ${m.name}${m.dosage ? ` (${m.dosage})` : ""}${m.instructions ? ` - ${m.instructions}` : ""}`)
      .join("\n");

    const prompt = `You are CuraSync's AI Drug Safety Advisor. Analyze the following medications for drug-drug interactions, food contraindications, and timing conflicts.

Patient's current medications:
${medList}

Return ONLY a valid JSON object (no markdown):
{
  "safe": true/false,
  "overallRisk": "safe/low/moderate/high/critical",
  "interactions": [
    {
      "type": "drug-drug/food/timing",
      "severity": "low/moderate/high/critical",
      "medicines": ["Bay 1 MedName", "Bay 2 MedName"],
      "description": "Clear explanation of the interaction",
      "recommendation": "What to do about it (e.g. Take 2 hours apart, avoid grapefruit)"
    }
  ],
  "generalAdvice": "Overall safety summary in 1-2 sentences for the patient/caregiver",
  "timingConflicts": [
    {
      "bay1": 1,
      "bay2": 2,
      "suggestedDelay": "e.g. 1 hour",
      "reason": "Brief reason"
    }
  ]
}

Rules:
- Only flag real, clinically significant interactions
- Be specific with recommendations
- If only 1 medicine or no interactions found, return safe:true with empty interactions array
- Use simple language understandable by elderly patients and caregivers`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    let parsed;
    try {
      const clean = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ safe: true, interactions: [], generalAdvice: "Unable to analyze interactions at this time." });
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("Drug interaction check error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to check drug interactions" },
      { status: 500 }
    );
  }
}
