import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { connectDB } from "@/lib/mongoose";
import { AuditLog } from "@/lib/models/AuditLog";

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

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ data: [], total: 0, page: 1 });
    }

    await connectDB();

    const url = new URL(request.url);
    const search = url.searchParams;

    const agentId = search.get("agentId") || undefined;
    const callId = search.get("callId") || undefined;
    const from = search.get("from");
    const to = search.get("to");
    const page = Math.max(parseInt(search.get("page") || "1", 10), 1);
    const limit = 25;
    const skip = (page - 1) * limit;

    const query: any = { companyId: ctx.companyId };
    if (agentId) query.agentId = agentId;
    if (callId) query.callId = callId;

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    return NextResponse.json({
      data: logs,
      total,
      page,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

