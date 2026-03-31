import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(request: NextRequest) {
  try {
    const { conferenceSid, participantSid, hold } = await request.json();

    if (!conferenceSid || !participantSid) {
       return NextResponse.json({ error: "Missing Sid" }, { status: 400 });
    }

    // Update the participant's hold state
    // When hold is true, we play a custom hold message (waitUrl)
    const baseUrl = process.env.NGROK_URL || request.nextUrl.origin;
    await client.conferences(conferenceSid)
      .participants(participantSid)
      .update({
        hold: !!hold,
        holdUrl: `${baseUrl}/api/twilio/hold-prompt`
      });

    return NextResponse.json({ success: true, status: hold ? "hold" : "active" });
  } catch (err: any) {
    console.error("Hold Toggle Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
