import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { z } from "zod";
import { callGroq } from "@/lib/groq";

async function requireCompanyAdmin() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("aura-session")?.value;
    if (!sessionCookie) {
      return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;
    if (!uid) {
      return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return { ok: false as const, response: NextResponse.json({ error: "User not found" }, { status: 401 }) };
    }

    const data = userDoc.data();
    if (!data) {
      return { ok: false as const, response: NextResponse.json({ error: "User data missing" }, { status: 401 }) };
    }

    if (data.role !== "admin" && data.role !== "company_admin") {
      return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }

    if (!data.companyId) {
      return { ok: false as const, response: NextResponse.json({ error: "Company ID missing" }, { status: 400 }) };
    }

    return { ok: true as const, companyId: data.companyId as string };
  } catch (error) {
    console.error("Auth verification error:", error);
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

const sentimentSchema = z.object({
  transcript: z.string().min(1, "Transcript required"),
  speaker: z.enum(["agent", "customer"]).default("customer"),
  callId: z.string().optional(),
  agentId: z.string().optional(),
});

// POST: Analyze sentiment in transcript chunk
export async function POST(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const json = await request.json();
    const parsed = sentimentSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { transcript, speaker, callId, agentId } = parsed.data;

    // Use Groq for sentiment analysis
    const systemPrompt = `You are a sentiment analyzer for call center transcripts. 
    Analyze the provided transcript and respond ONLY with a valid JSON object.
    Required structure:
    {
      "sentiment": "positive" | "negative" | "neutral",
      "score": number (-1 to 1),
      "confidence": number (0 to 1),
      "escalationRisk": boolean,
      "keyEmotions": string[]
    }`;

    const userPrompt = `Speaker type: ${speaker}
    Transcript chunk: "${transcript}"`;

    const response = await callGroq(systemPrompt, userPrompt, 250);

    if (!response) {
      throw new Error("No response from Groq");
    }

    let analysis;
    try {
      analysis = JSON.parse(response);
    } catch (parseError) {
      console.error("Failed to parse sentiment analysis:", response);
      // Fallback analysis
      analysis = {
        sentiment: "neutral",
        score: 0,
        confidence: 0.5,
        escalationRisk: false,
        keyEmotions: ["unclear"]
      };
    }

    // Log sentiment analysis for escalation tracking if it's a high risk customer chunk
    if (callId && (analysis.escalationRisk || (speaker === "customer" && analysis.sentiment === "negative"))) {
      await adminDb.collection("sentimentAlerts").add({
        companyId: auth.companyId,
        callId,
        agentId: agentId || null,
        transcript,
        speaker,
        analysis,
        alertedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ...analysis,
      speaker,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Sentiment analysis error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}