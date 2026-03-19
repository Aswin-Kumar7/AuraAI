import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase-admin";

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("aura-session")?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const agentId = decoded.uid;

    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const apiKey = process.env.TWILIO_API_KEY!;
    const apiSecret = process.env.TWILIO_API_SECRET!;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID!;

    const token = new AccessToken(accountSid, apiKey, apiSecret, { 
       identity: agentId,
       ttl: 3600 
    });
    
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true, 
    });
    
    token.addGrant(voiceGrant);

    return NextResponse.json({ 
       token: token.toJwt(), 
       identity: agentId 
    });
  } catch (error: any) {
    console.error("Twilio Token Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
