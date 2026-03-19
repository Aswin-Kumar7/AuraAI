import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import { Call } from "@/lib/models/Call";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    let agentsOnline = 0;
    try {
      const whitelistSnap = await adminDb.collection("whitelist").where("role", "==", "agent").get();
      agentsOnline = whitelistSnap.size;
    } catch (e) {
      console.error("Firestore error:", e);
    }
    
    let callsToday = 0;
    let avgAHT = 0;
    let avgCSAT = 0;
    
    try {
      if (process.env.MONGODB_URI) {
        await connectDB();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const stats = await Call.aggregate([
          { $match: { timestamp: { $gte: startOfDay } } },
          { 
            $group: { 
              _id: null, 
              total: { $sum: 1 },
              avgDuration: { $avg: "$duration" },
              avgCsat: { $avg: "$csat" }
            }
          }
        ]);

        if (stats.length > 0) {
          callsToday = stats[0].total;
          avgAHT = Math.round(stats[0].avgDuration || 0);
          avgCSAT = Math.round((stats[0].avgCsat || 0) * 10) / 10;
        }
      }
    } catch (e) {
      console.error("MongoDB error:", e);
    }

    return NextResponse.json({ agentsOnline, callsToday, avgAHT, avgCSAT });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
