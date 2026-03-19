import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { connectDB } from "@/lib/mongoose";
import { Call } from "@/lib/models/Call";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// Initialize Firebase Admin if not already done
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { callId } = await params;
    if (!callId) {
      return NextResponse.json({ error: "Call ID required" }, { status: 400 });
    }

    // Verify the call belongs to this agent
    await connectDB();
    const call = await Call.findOne({ callId, assignedAgentId: uid });
    if (!call) {
      return NextResponse.json({ error: "Call not found or not assigned to you" }, { status: 404 });
    }

    // 1. End call via Twilio
    try {
      await twilioClient.calls(callId).update({ status: "completed" });
    } catch (twilioError) {
      console.warn("Twilio end call failed:", twilioError);
      // Continue anyway as the call might already be ended
    }

    // 2. Update MongoDB Call
    await Call.findOneAndUpdate(
      { callId },
      { status: "completed", endedAt: new Date() }
    );

    // 3. Update Firestore liveCallState
    const db = getFirestore();
    await db.collection("liveCallState").doc(callId).update({
      status: "ended",
      endedAt: new Date().toISOString(),
    });

    // 4. Update agentPresence → available
    await db.collection("agentPresence").doc(uid).update({
      status: "available",
      callId: null,
      incomingCall: null,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Call ended successfully" });
  } catch (error) {
    console.error("End call error:", error);
    return NextResponse.json({ error: "Failed to end call" }, { status: 500 });
  }
}