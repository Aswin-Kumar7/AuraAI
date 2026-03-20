import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const db = adminDb;
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));

    // 1. Calculate Agents Online (from agentPresence)
    const presenceSnap = await db.collection("agentPresence")
      .where("status", "==", "available")
      .get();
    const agentsOnline = presenceSnap.size;

    // 2. Fetch Todays Calls (from Firestore)
    const callsSnap = await db.collection("calls")
      .where("createdAt", ">=", startOfDay.toISOString())
      .get();

    let callsToday = callsSnap.size;
    let totalDuration = 0;
    let totalSentiment = 0;
    let sentimentCount = 0;

    callsSnap.docs.forEach((doc) => {
      const data = doc.data();
      totalDuration += data.duration || 0;
      if (data.sentimentScore !== undefined) {
        totalSentiment += data.sentimentScore;
        sentimentCount++;
      }
    });

    const avgAHT = callsToday > 0 ? Math.round(totalDuration / callsToday) : 0;
    
    // Scale -1 to 1 into 0-5 for "CSAT" style display
    const rawAvgSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;
    const avgCSAT = Math.round(((rawAvgSentiment + 1) * 2.5) * 10) / 10;

    return NextResponse.json({ 
      agentsOnline, 
      callsToday, 
      avgAHT, 
      avgCSAT 
    });
  } catch (error: any) {
    console.error("Stats Migration Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
