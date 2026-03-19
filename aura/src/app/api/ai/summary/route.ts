import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { z } from "zod";
// Removed MongoDB imports for Firestore migration
import { buildSummaryPrompt } from "@/lib/prompts";
import { callGroq } from "@/lib/groq";
import { updateCallerMemoryAfterCall } from "@/lib/memory";

const bodySchema = z.object({
  callId: z.string(),
});

async function getContext() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("aura-session")?.value;
  if (!sessionCookie) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let uid: string | undefined;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decoded.uid;
  } catch {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!uid) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return { ok: false as const, response: NextResponse.json({ error: "User not found" }, { status: 401 }) };
  }

  const data = userDoc.data() as any;
  if (!data?.companyId) {
    return { ok: false as const, response: NextResponse.json({ error: "Company ID missing" }, { status: 400 }) };
  }

  return { ok: true as const, companyId: data.companyId as string };
}

export async function POST(request: Request) {
  try {
    const ctx = await getContext();
    if (!ctx.ok) return ctx.response;

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message || "Invalid payload" }, { status: 400 });
    }

    const { callId } = parsed.data;

    // 1. Fetch Call from Firestore
    const callSnap = await adminDb.collection("liveCallState").doc(callId).get();
    if (!callSnap.exists) {
      // Fallback: check main calls collection
      const mainSnap = await adminDb.collection("calls").doc(callId).get();
      if (!mainSnap.exists) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
    }

    const callDoc = callSnap.data() as any;
    const transcript = Array.isArray(callDoc.transcript) ? callDoc.transcript : [];
    const sentimentArc = Array.isArray(callDoc.sentimentArc) ? callDoc.sentimentArc : [];

    // 2. Fetch companyName
    const configSnap = await adminDb.collection("companyConfig").doc(ctx.companyId).get();
    const companyName: string = (configSnap.data() as any)?.companyName || "";

    // 3. Call Groq summary
    const summaryPrompt = buildSummaryPrompt(transcript as any, sentimentArc as any, companyName);
    const systemPrompt = `
You summarize completed phone calls for supervisors. 
You MUST respond with a single valid JSON object.
Do not include markdown or extra text.
`;
    const groqText = await callGroq(systemPrompt, summaryPrompt, 800);

    // 4. Parse JSON
    let summaryJson: any = {};
    if (groqText) {
      try {
        summaryJson = JSON.parse(groqText);
      } catch (e) {
        console.error("Failed to parse summary JSON", e, groqText);
        summaryJson = {};
      }
    }

    const issueCategory = summaryJson.issueCategory || "";
    const issueSummary = summaryJson.issueSummary || "";
    const resolutionStatus = summaryJson.resolutionStatus || "";
    const resolutionSummary = summaryJson.resolutionSummary || "";
    const nextAction = summaryJson.nextAction || "";
    const sentimentArcDescription = summaryJson.sentimentArcDescription || "";
    const callQualityScore =
      typeof summaryJson.callQualityScore === "number" ? summaryJson.callQualityScore : 0;

    const summaryPayload = {
      issueCategory,
      issueSummary,
      resolutionStatus,
      resolutionSummary,
      nextAction,
      sentimentArcDescription,
      callQualityScore,
    };

    // 5. Update Firestore Call Records
    const resolved = /resolved/i.test(resolutionStatus) || !!callDoc.resolved;

    const updateData = {
      summary: summaryPayload,
      issueCategory,
      resolved,
      status: "completed",
      updatedAt: new Date().toISOString()
    };

    // Update both places for consistency
    await adminDb.collection("calls").doc(callId).set(updateData, { merge: true });
    await adminDb.collection("liveCallState").doc(callId).set(updateData, { merge: true });

    // 7. Update CallerMemory (already migrated to Firestore in lib/memory)
    const phone: string | undefined = callDoc.callerPhone;
    if (phone) {
      await updateCallerMemoryAfterCall({
        companyId: ctx.companyId,
        phone,
        callId,
        issue: issueCategory || issueSummary,
        resolved,
        summary: resolutionSummary || issueSummary,
      });
    }

    // 8. Return summary
    return NextResponse.json({
      callId,
      summary: summaryPayload,
    });
  } catch (error: any) {
    console.error("AI summary error", error);
    return NextResponse.json(
      { error: error.message || "Internal server error", fallback: true },
      { status: 500 }
    );
  }
}

