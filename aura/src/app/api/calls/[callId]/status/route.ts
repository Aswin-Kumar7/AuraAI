import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";
import { connectDB } from "@/lib/mongoose";
import { Call } from "@/lib/models/Call";

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

    if (process.env.MONGODB_URI) {
      await connectDB();

      const call = await Call.findOneAndUpdate(
        { callId, agentId: auth.agentId },
        { resolved },
        { new: true }
      );

      if (!call) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, resolved: call.resolved });
    }

    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  } catch (error: any) {
    console.error("Error updating call status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}