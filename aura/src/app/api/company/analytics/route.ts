import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { connectDB } from "@/lib/mongoose";
import { Call } from "@/lib/models/Call";
import { Agent } from "@/lib/models/Agent";
import { CallerMemory } from "@/lib/models/CallerMemory";
import { AuditLog } from "@/lib/models/AuditLog";

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

  const userDoc = await adminAuth.getUser(uid);
  const companyId = userDoc.customClaims?.companyId as string;
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
    toDate.setHours(23, 59, 59, 999); // End of day

    if (process.env.MONGODB_URI) {
      await connectDB();

      const matchFilter = {
        companyId: auth.companyId,
        createdAt: { $gte: fromDate, $lte: toDate }
      };

      // Daily Calls
      const dailyCalls = await Call.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { "_id": 1 } },
        {
          $project: {
            date: "$_id",
            count: 1,
            _id: 0
          }
        }
      ]);

      // Per Agent Stats
      const perAgentStats = await Call.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: "$agentId",
            calls: { $sum: 1 },
            avgAHT: { $avg: "$duration" },
            avgCSAT: { $avg: "$summary.callQualityScore" },
            resolved: { $sum: { $cond: ["$resolved", 1, 0] } },
            total: { $sum: 1 }
          }
        },
        {
          $project: {
            agentId: "$_id",
            calls: 1,
            avgAHT: { $round: ["$avgAHT", 0] },
            avgCSAT: { $round: ["$avgCSAT", 1] },
            resolvedRate: { $round: [{ $multiply: [{ $divide: ["$resolved", "$total"] }, 100] }, 1] },
            _id: 0
          }
        }
      ]);

      // Get agent names and suggestions used
      const agentIds = perAgentStats.map(stat => stat.agentId);
      const agents = await Agent.find({ uid: { $in: agentIds } }).select('uid name');
      const agentMap = agents.reduce((map, agent) => {
        map[agent.uid] = agent.name;
        return map;
      }, {} as Record<string, string>);

      // Suggestions used rate
      const suggestionsStats = await AuditLog.aggregate([
        { $match: { companyId: auth.companyId, timestamp: { $gte: fromDate, $lte: toDate } } },
        {
          $group: {
            _id: "$agentId",
            used: { $sum: { $cond: ["$agentUsed", 1, 0] } },
            total: { $sum: 1 }
          }
        },
        {
          $project: {
            agentId: "$_id",
            suggestionsUsedRate: { $round: [{ $multiply: [{ $divide: ["$used", "$total"] }, 100] }, 1] },
            _id: 0
          }
        }
      ]);
      const suggestionsMap = suggestionsStats.reduce((map, stat) => {
        map[stat.agentId] = stat.suggestionsUsedRate;
        return map;
      }, {} as Record<string, number>);

      perAgentStats.forEach(stat => {
        stat.agentName = agentMap[stat.agentId] || "Unknown";
        stat.suggestionsUsedRate = suggestionsMap[stat.agentId] || 0;
      });

      // Sentiment Trend
      const sentimentTrend = await Call.aggregate([
        { $match: matchFilter },
        { $unwind: "$sentimentArc" },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$sentimentArc.timestamp" }
            },
            avgSentiment: { $avg: "$sentimentArc.score" }
          }
        },
        { $sort: { "_id": 1 } },
        {
          $project: {
            date: "$_id",
            avgSentiment: { $round: ["$avgSentiment", 1] },
            _id: 0
          }
        }
      ]);

      // Repeat Issues
      const topRepeatIssues = await CallerMemory.aggregate([
        { $match: { companyId: auth.companyId } },
        { $unwind: "$history" },
        {
          $match: {
            "history.date": { $gte: fromDate, $lte: toDate }
          }
        },
        {
          $group: {
            _id: "$history.issue",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $project: {
            issue: "$_id",
            count: 1,
            _id: 0
          }
        }
      ]);

      // Additional metrics
      const totalCalls = await Call.countDocuments(matchFilter);
      const avgAHT = await Call.aggregate([
        { $match: { ...matchFilter, duration: { $exists: true } } },
        { $group: { _id: null, avg: { $avg: "$duration" } } }
      ]);
      const avgAHTValue = avgAHT.length > 0 ? Math.round(avgAHT[0].avg) : 0;

      const aiAdoption = await AuditLog.aggregate([
        { $match: { ...matchFilter } },
        {
          $group: {
            _id: null,
            used: { $sum: { $cond: ["$agentUsed", 1, 0] } },
            total: { $sum: 1 }
          }
        }
      ]);
      const aiAdoptionRate = aiAdoption.length > 0 ? Math.round((aiAdoption[0].used / aiAdoption[0].total) * 100) : 0;

      const escalationRate = await Call.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            escalated: { $sum: { $cond: [{ $eq: ["$status", "escalated"] }, 1, 0] } },
            total: { $sum: 1 }
          }
        }
      ]);
      const escalationRateValue = escalationRate.length > 0 ? Math.round((escalationRate[0].escalated / escalationRate[0].total) * 100) : 0;

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
    }

    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  } catch (error: any) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}