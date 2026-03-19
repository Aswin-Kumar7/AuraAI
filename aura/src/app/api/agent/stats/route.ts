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

export async function GET() {
  try {
    const auth = await requireAgentContext();
    if (!auth.ok) return auth.response;

    const { agentId } = auth;
    
    // Stats from Firestore 'calls' collection
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const callsSnap = await adminDb.collection("calls")
      .where("agentId", "==", agentId)
      .where("createdAt", ">=", todayIso)
      .get();

    const callsToday = callsSnap.size;
    
    let totalDuration = 0;
    let completedCount = 0;
    let totalCSAT = 0;
    let csatCount = 0;

    callsSnap.forEach((doc: any) => {
      const data = doc.data();
      if (data.status === "completed" && typeof data.duration === "number") {
        totalDuration += data.duration;
        completedCount++;
      }
      if (data.summary?.callQualityScore) {
        totalCSAT += data.summary.callQualityScore;
        csatCount++;
      }
    });

    const avgAHT = completedCount > 0 ? totalDuration / completedCount : 0;
    const avgCSAT = csatCount > 0 ? totalCSAT / csatCount : 0;

    return NextResponse.json({
      callsToday,
      avgAHT: Math.round(avgAHT),
      avgCSAT: Math.round(avgCSAT * 10) / 10 
    });

    return NextResponse.json({ callsToday: 0, avgAHT: 0, avgCSAT: 0 });
  } catch (error: any) {
    console.error("Error fetching agent stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}