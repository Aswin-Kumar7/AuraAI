import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { z } from "zod";

async function requireCompanyAdmin() {
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

  const data = userDoc.data() as any;
  if (data?.role !== "admin" && data?.role !== "company_admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (!data?.companyId) {
    return { ok: false as const, response: NextResponse.json({ error: "Company ID missing" }, { status: 400 }) };
  }

  return { ok: true as const, companyId: data.companyId as string };
}

const detectSchema = z.object({
  transcript: z.string().min(1, "Transcript required"),
  agentId: z.string().optional(),
  callId: z.string().optional(),
});

// POST: Detect compliance violations in transcript
export async function POST(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const json = await request.json();
    const parsed = detectSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { transcript, agentId, callId } = parsed.data;

    // Get company's compliance rules
    const rulesSnap = await adminDb
      .collection("complianceRules")
      .where("companyId", "==", auth.companyId)
      .get();

    const rules = rulesSnap.docs.map(doc => ({
      id: doc.id,
      keyword: doc.data().keyword,
      description: doc.data().description,
      action: doc.data().action,
      severity: doc.data().severity,
      suggestedReplacement: doc.data().suggestedReplacement,
    }));

    // Simple keyword-based detection (can be enhanced with AI later)
    const violations: any[] = [];
    const lowerTranscript = transcript.toLowerCase();

    for (const rule of rules) {
      if (lowerTranscript.includes(rule.keyword.toLowerCase())) {
        violations.push({
          ruleId: rule.id,
          keyword: rule.keyword,
          description: rule.description,
          action: rule.action,
          severity: rule.severity,
          suggestedReplacement: rule.suggestedReplacement,
          detectedAt: new Date().toISOString(),
          confidence: 1.0, // Simple match = 100% confidence
        });
      }
    }

    // Log violations if any
    if (violations.length > 0 && callId) {
      await adminDb.collection("complianceViolations").add({
        companyId: auth.companyId,
        callId,
        agentId: agentId || null,
        transcript: transcript,
        violations,
        detectedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      violations,
      totalViolations: violations.length,
      message: violations.length > 0 ? "Violations detected" : "No violations found"
    });
  } catch (error: any) {
    console.error("Compliance detection error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}