import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageData, mimeType } = body; // imageData: base64 string

    if (!imageData) {
      return NextResponse.json({ error: "No image data provided" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured. Please add GEMINI_API_KEY to .env.local" },
        { status: 503 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

    const prompt = `You are a medical prescription parser for CuraSync, a smart pill dispenser app. 
Analyze this image (which may be a doctor's prescription slip, a medicine box, or a medicine label) and extract the medication information.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "medicines": [
    {
      "name": "Medicine name (generic or brand)",
      "dosage": "Dosage strength (e.g. 500mg, 10mg, 1 tablet)",
      "instructions": "Special instructions (e.g. Take after meals, with water)",
      "suggestedTime": "Suggested time in HH:MM 24hr format (e.g. 08:00 for morning, 14:00 for afternoon, 20:00 for evening)",
      "frequency": "once daily / twice daily / three times daily / as needed",
      "suggestedDays": [0,1,2,3,4,5,6],
      "suggestedCompartment": 1
    }
  ],
  "rawText": "Any relevant text found in the image",
  "confidence": "high/medium/low"
}

Rules:
- suggestedTime should be in HH:MM format. If frequency is "twice daily", provide time for the FIRST dose.
- suggestedDays should be array of day indices (0=Sunday, 6=Saturday). Daily = [0,1,2,3,4,5,6]
- suggestedCompartment should be 1, 2, or 3 (assign sequentially)
- If the image doesn't contain medical information, return: {"medicines": [], "rawText": "", "confidence": "low", "error": "No medicine information detected"}
- If multiple medicines are found, list all of them
- Be conservative with dosage - only extract what is clearly visible`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData,
          mimeType: mimeType || "image/jpeg",
        },
      },
    ]);

    const responseText = result.response.text().trim();
    
    // Parse JSON from response
    let parsed;
    try {
      // Remove potential markdown code blocks
      const clean = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: responseText },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error("Prescription scan error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process image" },
      { status: 500 }
    );
  }
}
