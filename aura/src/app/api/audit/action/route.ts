import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { z } from "zod";

const bodySchema = z.object({
  callId: z.string(),
  suggestionText: z.string(),
  suggestionRank: z.number(),
  agentUsed: z.boolean(),
});

async function getCompanyContext() {
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
    const ctx = await getCompanyContext();
    if (!ctx.ok) return ctx.response;

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message || "Invalid payload" }, { status: 400 });
    }

    const { callId, suggestionText, suggestionRank, agentUsed } = parsed.data;

    // Find the relevant audit log in Firestore
    const auditQuery = await adminDb.collection("auditLogs")
      .where("companyId", "==", ctx.companyId)
      .where("callId", "==", callId)
      .where("aiSuggestion", "==", suggestionText)
      .where("suggestionRank", "==", suggestionRank)
      .limit(1)
      .get();

    if (auditQuery.empty) {
      return NextResponse.json({ error: "Audit log not found" }, { status: 404 });
    }

    // Update the document
    const docRef = auditQuery.docs[0].ref;
    await docRef.update({ agentUsed });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Audit action error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

