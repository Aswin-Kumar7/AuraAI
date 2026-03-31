import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
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

export async function GET(request: Request) {
  try {
    const auth = await requireAgentContext();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let query: any = adminDb.collection("calls")
      .where("agentId", "==", auth.agentId)
      .orderBy("createdAt", "desc");

    if (status) {
       query = query.where("status", "==", status);
    }

    // Firestore doesn't support complex regex search like Mongo without a 3rd party
    // So we'll fetch then filter for search if requested, or keep it simple
    
    const snapshot = await query.get();
    const normalizeSummary = (summary: any) => {
      const source = (summary && typeof summary === "object") ? summary : {};
      const nextSteps = Array.isArray(source.nextSteps)
        ? source.nextSteps.map((step: unknown) => String(step || "").trim()).filter((step: string) => step.length > 0)
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

    let calls = snapshot.docs.map((doc: any) => {
      const data = doc.data() as any;
      const summary = normalizeSummary(data.summary);
      const issueCategory = deriveIssueCategory({
        explicitIssueCategory: data.issueCategory,
        intent: data.intent,
        intentTrend: data.intentTrend,
        issueSummary: summary.issueSummary || summary.briefSummary,
      });

      return {
        id: doc.id,
        ...data,
        summary,
        issueCategory,
      };
    });

    if (search) {
      const lowerSearch = search.toLowerCase();
      calls = calls.filter((c: any) => 
        (c.callerPhone?.toLowerCase().includes(lowerSearch)) ||
        (c.issueCategory?.toLowerCase().includes(lowerSearch))
      );
    }

    const total = calls.length;
    const paginatedCalls = calls.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      calls: paginatedCalls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("Error fetching agent calls:", error);
    return NextResponse.json({ 
       error: "Internal server error", 
       details: error.message 
    }, { status: 500 });
  }
}