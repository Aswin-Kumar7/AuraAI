import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
// Removed MongoDB imports for Firestore migration

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

    return NextResponse.json({ id: callSnap.id, ...call });
  } catch (error: any) {
    console.error("Error fetching call:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}