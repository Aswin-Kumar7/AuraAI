import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { finalizeCallAndGenerateSummary } from "@/lib/call-finalization";

const TERMINAL_STATUSES = new Set(["completed", "busy", "no-answer", "failed", "canceled"]);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = String(formData.get("CallSid") || "").trim();
    const parentCallSid = String(formData.get("ParentCallSid") || "").trim();
    const callStatus = String(formData.get("CallStatus") || "").trim().toLowerCase();

    const effectiveCallId = parentCallSid || callSid;
    if (!effectiveCallId) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 });
    }

    const now = new Date().toISOString();
    await adminDb.collection("liveCallState").doc(effectiveCallId).set(
      {
        twilioStatus: callStatus || "unknown",
        lastTwilioStatusAt: now,
      },
      { merge: true }
    );

    if (TERMINAL_STATUSES.has(callStatus)) {
      await finalizeCallAndGenerateSummary({
        callId: effectiveCallId,
        endedAt: now,
        endReason: `twilio-status-${callStatus}`,
      });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[Twilio Status] Error:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
