import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

async function requireCompanyContext() {
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

  const userDocSnapshot = await adminDb.collection("users").doc(uid).get();
  if (!userDocSnapshot.exists) {
    return { ok: false as const, response: NextResponse.json({ error: "User not found" }, { status: 401 }) };
  }

  const data = userDocSnapshot.data();
  const companyId = data?.companyId as string;
  if (!companyId) {
    return { ok: false as const, response: NextResponse.json({ error: "Company ID missing" }, { status: 400 }) };
  }

  return { ok: true as const, companyId };
}

export async function GET(request: Request) {
  try {
    const auth = await requireCompanyContext();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json({ error: "Missing from or to date" }, { status: 400 });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // 1. Fetch Calls from Firestore
    const callsSnap = await adminDb.collection("calls")
      .where("companyId", "==", auth.companyId)
      .where("createdAt", ">=", fromDate.toISOString())
      .where("createdAt", "<=", toDate.toISOString())
      .get();

    const calls = callsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Daily Calls Aggregation
    const dailyCallsMap: Record<string, number> = {};
    calls.forEach((call: any) => {
      const date = call.createdAt.split('T')[0];
      dailyCallsMap[date] = (dailyCallsMap[date] || 0) + 1;
    });
    const dailyCalls = Object.entries(dailyCallsMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    // 3. Per Agent Stats
    const agentStatsMap: Record<string, any> = {};
    calls.forEach((call: any) => {
      const aid = call.agentId;
      if (!agentStatsMap[aid]) {
        agentStatsMap[aid] = { agentId: aid, calls: 0, totalDuration: 0, totalCSAT: 0, resolvedCount: 0, csatCount: 0 };
      }
      const stat = agentStatsMap[aid];
      stat.calls += 1;
      if (call.duration) stat.totalDuration += call.duration;
      if (call.summary?.callQualityScore) {
        stat.totalCSAT += call.summary.callQualityScore;
        stat.csatCount += 1;
      }
      if (call.resolved) stat.resolvedCount += 1;
    });

    // Fetch Agent Names
    const agentIds = Object.keys(agentStatsMap);
    const agentsMap: Record<string, string> = {};
    if (agentIds.length > 0) {
      const agentsSnap = await adminDb.collection("users").where("__name__", "in", agentIds.slice(0, 10)).get(); // Firestore limitation: max 10 for 'in'
      agentsSnap.docs.forEach(doc => {
        agentsMap[doc.id] = doc.data().name || "Unknown";
      });
    }

    // 4. AI Adoption from AuditLogs
    const auditSnap = await adminDb.collection("auditLogs")
      .where("companyId", "==", auth.companyId)
      .where("timestamp", ">=", fromDate.toISOString())
      .where("timestamp", "<=", toDate.toISOString())
      .get();
    
    const auditLogs = auditSnap.docs.map(doc => doc.data());
    const auditByAgent: Record<string, { used: number, total: number }> = {};
    auditLogs.forEach((log: any) => {
      if (!auditByAgent[log.agentId]) auditByAgent[log.agentId] = { used: 0, total: 0 };
      auditByAgent[log.agentId].total += 1;
      if (log.agentUsed) auditByAgent[log.agentId].used += 1;
    });

    const perAgentStats = Object.values(agentStatsMap).map(stat => ({
      agentId: stat.agentId,
      agentName: agentsMap[stat.agentId] || "Agent",
      calls: stat.calls,
      avgAHT: stat.calls > 0 ? Math.round(stat.totalDuration / stat.calls) : 0,
      avgCSAT: stat.csatCount > 0 ? parseFloat((stat.totalCSAT / stat.csatCount).toFixed(1)) : 0,
      resolvedRate: stat.calls > 0 ? parseFloat(((stat.resolvedCount / stat.calls) * 100).toFixed(1)) : 0,
      suggestionsUsedRate: auditByAgent[stat.agentId] ? parseFloat(((auditByAgent[stat.agentId].used / auditByAgent[stat.agentId].total) * 100).toFixed(1)) : 0
    }));

    // 5. Sentiment Trends
    const sentimentTrendMap: Record<string, { total: number, count: number }> = {};
    calls.forEach((call: any) => {
      if (call.sentimentArc && Array.isArray(call.sentimentArc)) {
        call.sentimentArc.forEach((point: any) => {
          const sDate = point.timestamp?.split('T')[0];
          if (sDate) {
            if (!sentimentTrendMap[sDate]) sentimentTrendMap[sDate] = { total: 0, count: 0 };
            sentimentTrendMap[sDate].total += point.score;
            sentimentTrendMap[sDate].count += 1;
          }
        });
      }
    });
    const sentimentTrend = Object.entries(sentimentTrendMap).map(([date, data]) => ({
      date,
      avgSentiment: parseFloat((data.total / data.count).toFixed(1))
    })).sort((a, b) => a.date.localeCompare(b.date));

    // 6. Repeat Issues
    const memorySnap = await adminDb.collection("callerMemory")
      .where("companyId", "==", auth.companyId)
      .get();
    
    const issueCounts: Record<string, number> = {};
    memorySnap.docs.forEach(doc => {
      const history = doc.data().history || [];
      history.forEach((h: any) => {
        const hDate = new Date(h.date);
        if (hDate >= fromDate && hDate <= toDate) {
          issueCounts[h.issue] = (issueCounts[h.issue] || 0) + 1;
        }
      });
    });
    const topRepeatIssues = Object.entries(issueCounts)
      .map(([issue, count]) => ({ issue, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 7. Overall Metrics
    const totalCalls = calls.length;
    const totalDuration = calls.reduce((acc, c: any) => acc + (c.duration || 0), 0);
    const avgAHTValue = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    
    const totalAudit = auditLogs.length;
    const usedAudit = auditLogs.filter((l: any) => l.agentUsed).length;
    const aiAdoptionRate = totalAudit > 0 ? Math.round((usedAudit / totalAudit) * 100) : 0;

    const escalatedCalls = calls.filter((c: any) => c.status === "escalated").length;
    const escalationRateValue = totalCalls > 0 ? Math.round((escalatedCalls / totalCalls) * 100) : 0;

    return NextResponse.json({
      dailyCalls,
      perAgentStats,
      sentimentTrend,
      topRepeatIssues,
      metrics: {
        totalCalls,
        avgAHT: avgAHTValue,
        aiAdoptionRate,
        escalationRate: escalationRateValue
      }
    });

  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}