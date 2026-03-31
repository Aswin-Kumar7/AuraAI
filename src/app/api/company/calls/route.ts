import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const callsSnap = await adminDb.collection("calls")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const calls = callsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        timestamp: data.createdAt || new Date().toISOString(),
        callerMasked: data.callerPhone || "Unknown",
        issue:
          data.issueCategory ||
          data.summary?.briefSummary ||
          data.summary?.issueSummary ||
          data.lastTopic ||
          "N/A",
        duration: data.duration || 0,
        resolved: !!(data.resolved ?? data.isResolved),
        agentId: data.agentId || "Unknown"
      };
    });

    return NextResponse.json(calls);
  } catch (error: any) {
    console.error("Company Calls Migration Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
