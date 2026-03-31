import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const bodySchema = z.object({
  mode: z.enum(["whisper", "alert", "auto"]),
});

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

  return { ok: true as const, uid };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const auth = await requireAgentContext();
    if (!auth.ok) return auth.response;

    const { callId } = await params;
    if (!callId) {
      return NextResponse.json({ error: "Call ID required" }, { status: 400 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message || "Invalid payload" }, { status: 400 });
    }

    const { mode } = parsed.data;

    const liveRef = adminDb.collection("liveCallState").doc(callId);
    const liveSnap = await liveRef.get();
    if (!liveSnap.exists) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const liveData = liveSnap.data() as { agentId?: string } | undefined;
    if (liveData?.agentId && liveData.agentId !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await liveRef.set(
      {
        activeMode: mode,
        modeLockedByAgent: mode === "auto",
        modeUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      callId,
      activeMode: mode,
      modeLockedByAgent: mode === "auto",
    });
  } catch (error: any) {
    console.error("[Call Mode] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update call mode" },
      { status: 500 }
    );
  }
}
