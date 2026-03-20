import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const To = formData.get("customerPhone") as string;
    const From = formData.get("twilioCallerId") as string;
    const originalFrom = formData.get("From") as string; // Usually "client:agentId"
    const callSid = formData.get("CallSid") as string;
    const contextStr = formData.get("context") as string;
    const explicitAgentId = formData.get("agentId") as string;
    
    // Extract Agent ID from the client identity (preferred) or explicit param
    const identityMatch = originalFrom?.match(/client:(.*)/);
    const agentId = explicitAgentId || (identityMatch ? identityMatch[1] : "unknown-agent");

    console.log(`[Twilio Client Voice] Dialing To: ${To}, From: ${From}, Agent: ${agentId}`);

    // Setup TwiML
    const twiml = new twilio.twiml.VoiceResponse();
    
    twiml.say({ voice: 'Polly.Joanna' }, "Connecting you to the customer now.");

    const baseUrl = process.env.NGROK_URL || request.headers.get("origin") || request.nextUrl.origin;
    const isLocal = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
    // Ensure WSS Protocol
    const rawWsTunnel = process.env.WEBSOCKET_TUNNEL_URL || "";
    const wsTunnel = rawWsTunnel.replace(/^http(s?):\/\//, 'ws$1://');

    // Start media stream for AI transcription
    if (wsTunnel || !isLocal) {
      const wsUrl = wsTunnel || (baseUrl.replace(/^http(s?):\/\//, 'ws$1://') + ':3001');
      const start = twiml.start();
      start.stream({ url: wsUrl, track: "both_tracks" });
    }

    // Direct Dial (Simple P2P)
    if (To) {
      const dial = twiml.dial({ callerId: From || process.env.TWILIO_PHONE_NUMBER });
      dial.number({
         statusCallback: `${baseUrl}/api/twilio/customer-events`,
         statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
         statusCallbackMethod: 'POST'
      }, To);
    }

    // 3. Save to Firestore (Unified Backend)
    try {
      await adminDb.collection("calls").doc(callSid).set({
        callId: callSid,
        callerPhone: To,
        agentId: agentId,
        status: "active",
        createdAt: new Date().toISOString(),
      });
    } catch (saveErr) {}

    try {
      // 1. Fetch Agent's Company
      const agentDoc = await adminDb.collection("users").doc(agentId).get();
      const companyId = agentDoc.data()?.companyId || "aura-demo-id";

      // 2. Update Presence
      await adminDb.collection("agentPresence").doc(agentId).set({
        status: "on-call",
        callId: callSid,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // 3. Init Live State (With Company context)
      await adminDb.collection("liveCallState").doc(callSid).set({
        callId: callSid,
        agentId: agentId,
        companyId,
        status: "active",
        twilioInboundSpeaker: "agent",
        twilioOutboundSpeaker: "customer",
        transcript: [],
        currentSuggestions: [],
        sentimentScore: null,
        sentimentLabel: null,
        complianceAlert: false,
        knowledgeSnippet: "",
        isRepeatCaller: false,
        activeMode: "whisper",
        script: contextStr || "",
        createdAt: new Date().toISOString(),
      });
      
    } catch (dbErr) {}

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });

  } catch (err: any) {
    console.error("Client Voice Route Error:", err);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say("An application error occurred while dialing out.");
    return new NextResponse(twiml.toString(), { status: 200, headers: { "Content-Type": "text/xml" } });
  }
}
