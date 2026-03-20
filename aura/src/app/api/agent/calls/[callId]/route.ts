import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
// Removed MongoDB imports for Firestore migration
import { deriveIssueCategory } from "@/lib/call-categorization";

async function requireAgentContext() {
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

  return { ok: true as const, agentId: uid };
}

export async function GET(request: Request, { params }: { params: Promise<{ callId: string }> }) {
  try {
    const auth = await requireAgentContext();
    if (!auth.ok) return auth.response;

    const { callId } = await params;

    const normalizeSummary = (summary: any) => {
      const source = (summary && typeof summary === "object") ? summary : {};
      const nextSteps = Array.isArray(source.nextSteps)
        ? source.nextSteps.map((step: unknown) => String(step || "").trim()).filter((step: string) => step.length > 0)
        : source.nextAction
          ? [String(source.nextAction)]
          : [];

      return {
        ...source,
        briefSummary:
          source.briefSummary ||
          source.issueSummary ||
          source.resolutionSummary ||
          source.summary ||
          "",
        customerSentiment:
          source.customerSentiment ||
          source.sentimentArcDescription ||
          "Unknown",
        resolutionAction:
          source.resolutionAction ||
          source.nextAction ||
          source.resolutionSummary ||
          "",
        nextSteps,
        callQualityScore: Number.isFinite(Number(source.callQualityScore))
          ? Number(source.callQualityScore)
          : 0,
      };
    };

    // Fetch from Firestore 'calls' collection
    const callSnap = await adminDb.collection("calls").doc(callId).get();

    if (!callSnap.exists) {
      // Fallback: search in liveCallState in case it's very recent
      const liveSnap = await adminDb.collection("liveCallState").doc(callId).get();
      if (!liveSnap.exists) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      
      const liveData = liveSnap.data();
      if (liveData?.agentId !== auth.agentId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      return NextResponse.json({ id: liveSnap.id, ...liveData });
    }

    const call = callSnap.data();

    if (call?.agentId !== auth.agentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const liveSnap = await adminDb.collection("liveCallState").doc(callId).get();
    const liveData = (liveSnap.data() || {}) as any;

    const transcript = Array.isArray(call?.transcript)
      ? call.transcript
      : Array.isArray(liveData.transcript)
        ? liveData.transcript
        : [];
    const sentimentArc = Array.isArray(call?.sentimentArc)
      ? call.sentimentArc
      : Array.isArray(liveData.sentimentArc)
        ? liveData.sentimentArc
        : [];

    const summary = normalizeSummary(call?.summary);
    const issueCategory = deriveIssueCategory({
      explicitIssueCategory: call?.issueCategory,
      intent: call?.intent || liveData.intent,
      intentTrend: call?.intentTrend || liveData.intentTrend,
      issueSummary: summary.issueSummary || summary.briefSummary,
    });

    return NextResponse.json({
      id: callSnap.id,
      ...call,
      transcript,
      sentimentArc,
      summary,
      issueCategory,
    });
  } catch (error: any) {
    console.error("Error fetching call:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}