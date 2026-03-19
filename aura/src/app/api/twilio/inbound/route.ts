import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get("CallSid") as string;
    const from = formData.get("From") as string;

    if (!callSid || !from) {
      return NextResponse.json({ error: "Missing CallSid or From" }, { status: 400 });
    }

    const db = adminDb;

    // Find available agent
    const agentsRef = db.collection("agentPresence");
    const agentSnapshot = await agentsRef.where("status", "==", "available").limit(1).get();

    if (agentSnapshot.empty) {
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say("All agents are currently busy. Please try again later.");
      twiml.hangup();
      return new NextResponse(twiml.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const agentSnap = agentSnapshot.docs[0];
    const agentId = agentSnap.id;

    // Assign call and initialize state in Firestore
    const batch = db.batch();
    
    // 1. Update Agent Presence
    batch.update(agentSnap.ref, {
      status: "on-call",
      callId: callSid,
      incomingCall: { callId: callSid, callerPhone: from },
      updatedAt: new Date().toISOString(),
    });

    // 2. Create Call Record (Replacing MongoDB)
    const callRef = db.collection("calls").doc(callSid);
    batch.set(callRef, {
      callId: callSid,
      callerPhone: from,
      agentId: agentId,
      status: "active",
      createdAt: new Date().toISOString(),
    });

    // 3. Initialize Live Call State (Crucial for transcription)
    const liveRef = db.collection("liveCallState").doc(callSid);
    batch.set(liveRef, {
      callId: callSid,
      agentId: agentId,
      status: "active",
      transcript: [],
      currentSuggestions: [],
      sentimentScore: null,
      sentimentLabel: "Neutral",
      complianceAlert: false,
      activeMode: "whisper",
      createdAt: new Date().toISOString(),
    });

    await batch.commit();

    // Start WebSocket Stream — pointing to Python STT Server (Port 3001)
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("Connecting you to our support agent now. Powered by Aura AI.");
    
    // Construct WebSocket URL using NGROK/Tunnel URL
    const publicUrl = process.env.NGROK_URL || request.nextUrl.origin;
    const wsUrl = publicUrl.replace(/^http(s?):\/\//, 'ws$1://');
    
    // Back to :3001 to match your Cloudflare Tunnel!
    const finalWsUrl = process.env.NGROK_URL ? wsUrl : `ws://127.0.0.1:3001/ws`;

    const connect = twiml.connect();
    connect.stream({
      url: finalWsUrl,
      track: "inbound_track",
    });

    return new NextResponse(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Inbound call error:", error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("We're experiencing technical difficulties. Please try again.");
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
