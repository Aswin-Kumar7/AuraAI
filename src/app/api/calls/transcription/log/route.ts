import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET || "aura_internal_prod_secret_123";

const logTranscriptionSchema = z.object({
  callId: z.string().min(1, "callId required"),
  speaker: z.enum(["agent", "customer"]),
  text: z.string().min(1, "text required"),
  timestamp: z.string().datetime().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["agent-browser-stt", "customer-twilio", "manual"]).optional(),
});

type TranscriptionLog = z.infer<typeof logTranscriptionSchema>;

/**
 * POST /api/calls/transcription/log
 * Log a transcription line to a live call.
 * Used as fallback for agent speech if Web Speech API unavailable,
 * or for manual speech submission.
 */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = logTranscriptionSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { callId, speaker, text, timestamp, confidence, source } = parsed.data;

    // Validate text length
    if (text.trim().length < 2) {
      return NextResponse.json(
        { error: "Text too short (minimum 2 characters)" },
        { status: 400 }
      );
    }

    // Get live call state to ensure call exists
    const liveRef = adminDb.collection("liveCallState").doc(callId);
    const liveSnap = await liveRef.get();

    if (!liveSnap.exists) {
      return NextResponse.json(
        { error: "Call not found", callId },
        { status: 404 }
      );
    }

    const now = new Date();
    const ts = timestamp || now.toISOString();

    // Add transcript entry using proper Firebase FieldValue
    try {
      await liveRef.update({
        transcript: FieldValue.arrayUnion({
          speaker,
          text: text.trim(),
          timestamp: ts,
          confidence: confidence ?? 0.95,
          source: source ?? "manual",
        }),
        lastTranscriptAt: ts,
        viewed: false,
      });
    } catch (firestoreError: any) {
      if (firestoreError.code === "not-found") {
        return NextResponse.json(
          { error: "Call ended or was deleted", callId },
          { status: 404 }
        );
      }
      if (firestoreError.code === "permission-denied") {
        return NextResponse.json(
          { error: "Permission denied", callId },
          { status: 403 }
        );
      }
      throw firestoreError;
    }

    // Keep live intelligence updated even when transcript comes from fallback path.
    try {
      const analyzeUrl = new URL("/api/ai/analyze", request.url).toString();
      await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_API_SECRET,
        },
        body: JSON.stringify({
          callId,
          newLine: {
            speaker,
            text: text.trim(),
            timestamp: ts,
          },
        }),
      });
    } catch (analysisError) {
      console.warn("[Transcription Log] Analysis trigger failed:", analysisError);
    }

    return NextResponse.json({
      success: true,
      callId,
      speaker,
      text: text.trim(),
      timestamp: ts,
      message: "Transcription logged successfully",
    });
  } catch (error: any) {
    console.error("[Transcription Log] Error:", error);
    
    // Handle specific Firestore errors
    if (error.code === "not-found") {
      return NextResponse.json(
        { error: "Call not found or was deleted" },
        { status: 404 }
      );
    }
    if (error.code === "permission-denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    if (error.code === "invalid-argument") {
      return NextResponse.json(
        { error: "Invalid argument provided" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to log transcription" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/calls/transcription/log?callId={callId}
 * Retrieve transcription for a call.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");

    if (!callId) {
      return NextResponse.json(
        { error: "callId query parameter required" },
        { status: 400 }
      );
    }

    const liveRef = adminDb.collection("liveCallState").doc(callId);
    const liveSnap = await liveRef.get();

    if (!liveSnap.exists) {
      return NextResponse.json(
        { error: "Call not found", callId },
        { status: 404 }
      );
    }

    const data = liveSnap.data();
    const transcript = (data?.transcript || []).map((entry: any) => ({
      speaker: entry.speaker,
      text: entry.text,
      timestamp: entry.timestamp,
      confidence: entry.confidence ?? 1,
      source: entry.source ?? "unknown",
      engine: entry.engine,
    }));

    return NextResponse.json({
      success: true,
      callId,
      transcript,
      totalLines: transcript.length,
      lastUpdated: data?.lastTranscriptAt || null,
      sentimentScore: data?.sentimentScore ?? null,
      sentimentLabel: data?.sentimentLabel ?? null,
    });
  } catch (error: any) {
    console.error("[Transcription Log GET] Error:", error);
    
    if (error.code === "permission-denied") {
      return NextResponse.json(
        { error: "Permission denied" },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to retrieve transcription" },
      { status: 500 }
    );
  }
}
