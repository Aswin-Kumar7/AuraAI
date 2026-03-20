import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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

    // 2. Update Firestore liveCallState (Dashboard & Session Management)
    await adminDb.collection("liveCallState").doc(callId).update({
      status: "ended",
      activeMode: "auto",
      endedAt: new Date().toISOString(),
    });

    // 3. Update agentPresence → available
    await adminDb.collection("agentPresence").doc(uid).update({
      status: "available",
      callId: null,
      incomingCall: null,
      updatedAt: new Date().toISOString(),
    });

    // 4. Update the call record itself if it exists in the 'calls' collection
    try {
      await adminDb.collection("calls").doc(callId).update({
        status: "completed",
        endedAt: new Date().toISOString(),
      });
    } catch (err) {
      // It might not exist in the 'calls' collection yet or might be in liveCallState only
    }

    return NextResponse.json({ 
      success: true, 
      message: "Call ended successfully in Firebase and Twilio"
    });

  } catch (error: any) {
    console.error("Critical End Call Error:", error);
    return NextResponse.json({ 
      error: "Failed to end call", 
      details: error.message 
    }, { status: 500 });
  }
}