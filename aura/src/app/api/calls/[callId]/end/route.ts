import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { adminAuth } from "@/lib/firebase-admin";
import { finalizeCallAndGenerateSummary } from "@/lib/call-finalization";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;
  
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (!callId) {
      return NextResponse.json({ error: "Call ID required" }, { status: 400 });
    }

    // 1. End call via Twilio
    try {
      await twilioClient.calls(callId).update({ status: "completed" });
    } catch (twilioError) {
      console.warn("[Twilio] End call failed (might already be ended):", twilioError);
    }

    // 2. Finalize and summarize call in one shared backend path.
    const finalized = await finalizeCallAndGenerateSummary({
      callId,
      agentId: uid,
      endReason: "manual-end",
    });

    return NextResponse.json({ 
      success: true, 
      message: "Call ended and summarized successfully",
      result: finalized,
    });

  } catch (error: any) {
    console.error("Critical End Call Error:", error);
    return NextResponse.json({ 
      error: "Failed to end call", 
      details: error.message 
    }, { status: 500 });
  }
}