import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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

export async function PATCH(request: Request, { params }: { params: Promise<{ callId: string }> }) {
  try {
    const auth = await requireAgentContext();
    if (!auth.ok) return auth.response;

    const { callId } = await params;
    const body = await request.json();
    const { resolved } = body;

    if (typeof resolved !== "boolean") {
      return NextResponse.json({ error: "Invalid resolved value" }, { status: 400 });
    }

    const db = adminDb;
    
    // 1. Update live call state
    const liveRef = db.collection("liveCallState").doc(callId);
    const liveSnap = await liveRef.get();
    
    if (liveSnap.exists) {
      await liveRef.update({ isResolved: resolved });
    }

    // 2. Update permanent call record
    const callRef = db.collection("calls").doc(callId);
    await callRef.update({ isResolved: resolved });

    return NextResponse.json({ success: true, resolved });
  } catch (error: any) {
    console.error("Call Status Migration Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}