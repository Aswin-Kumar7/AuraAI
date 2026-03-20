import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { to, from, context } = await request.json();
    if (!to || !from) {
      return NextResponse.json({ error: "Missing to or from" }, { status: 400 });
    }

    // Generate TwiML dynamically that connects to the Web Socket stream for STT
    // and speaks a greeting since we aren't using Twilio Client browser SDK natively yet.
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Connecting you to a representative.");

    // Construct WebSocket URL using NGROK/Tunnel URL
    const baseUrl = process.env.NGROK_URL || request.headers.get("origin") || request.nextUrl.origin;
    const wsUrl = baseUrl.replace(/^http(s?):\/\//, 'ws$1://');
    
    // Point to Python server (Port 3001 — to match your Tunnel)
    const finalWsUrl = process.env.NGROK_URL ? wsUrl : `ws://127.0.0.1:3001/ws`;

    const connect = twiml.connect();
    connect.stream({ url: finalWsUrl, track: "both_tracks" });

    // Initiate outbound call
    const call = await twilioClient.calls.create({
      twiml: twiml.toString(),
      to,
      from,
      statusCallback: `${baseUrl}/api/twilio/status`, // Future proofing
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });

    const db = adminDb;
    const batch = db.batch();
    const agentUserSnap = await db.collection("users").doc(uid).get();
    const companyId = agentUserSnap.data()?.companyId || "aura-demo-id";

    // 1. Create Call Record (Replacing MongoDB)
    const callRef = db.collection("calls").doc(call.sid);
    batch.set(callRef, {
      callId: call.sid,
      callerPhone: to,
      agentId: uid,
      companyId,
      status: "active",
      createdAt: new Date().toISOString(),
    });

    // 2. Update Agent Presence
    const agentRef = db.collection("agentPresence").doc(uid);
    batch.update(agentRef, {
      status: "on-call",
      callId: call.sid,
      updatedAt: new Date().toISOString(),
    });

    // 3. Initialize Live Call State
    const liveRef = db.collection("liveCallState").doc(call.sid);
    batch.set(liveRef, {
      callId: call.sid,
      agentId: uid,
      companyId,
      status: "active",
      twilioInboundSpeaker: "customer",
      twilioOutboundSpeaker: "agent",
      transcript: [],
      currentSuggestions: [],
      sentimentScore: null,
      sentimentLabel: "Neutral",
      complianceAlert: false,
      activeMode: "whisper",
      script: context || "",
      createdAt: new Date().toISOString(),
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      callId: call.sid,
      message: "Outbound call initiated"
    });
  } catch (error) {
    console.error("Outbound call error:", error);
    return NextResponse.json({ error: "Failed to initiate call" }, { status: 500 });
  }
}