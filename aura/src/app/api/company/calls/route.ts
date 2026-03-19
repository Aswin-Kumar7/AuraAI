import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongoose";
import { Call } from "@/lib/models/Call";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (process.env.MONGODB_URI) {
      await connectDB();

      const calls = await Call.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .select('timestamp agentEmail callerMasked issue duration resolved')
        .lean();

      return NextResponse.json(calls);
    }
    
    return NextResponse.json([]);
  } catch (error: any) {
    console.error("Mongoose error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
