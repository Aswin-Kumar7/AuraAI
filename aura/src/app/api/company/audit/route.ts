import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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

export async function GET(request: Request) {
  try {
    const ctx = await getCompanyContext();
    if (!ctx.ok) return ctx.response;

    const url = new URL(request.url);
    const search = url.searchParams;

    const agentId = search.get("agentId") || undefined;
    const callId = search.get("callId") || undefined;
    const from = search.get("from");
    const to = search.get("to");
    const page = Math.max(parseInt(search.get("page") || "1", 10), 1);
    const limit = 25;
    const skip = (page - 1) * limit;

    let queryRef: any = adminDb.collection("auditLogs").where("companyId", "==", ctx.companyId);

    if (agentId) {
      queryRef = queryRef.where("agentId", "==", agentId);
    }
    if (callId) {
      queryRef = queryRef.where("callId", "==", callId);
    }
    
    // Firestore range queries on timestamp
    if (from) {
      queryRef = queryRef.where("timestamp", ">=", from);
    }
    if (to) {
      queryRef = queryRef.where("timestamp", "<=", to);
    }

    // Count total results for pagination
    const countSnap = await queryRef.count().get();
    const total = countSnap.data().count;

    // Fetch paginated and sorted logs
    const logsSnap = await queryRef
      .orderBy("timestamp", "desc")
      .offset(skip)
      .limit(limit)
      .get();

    const logs = logsSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      data: logs,
      total,
      page,
    });
  } catch (error: any) {
    console.error("Audit log error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

