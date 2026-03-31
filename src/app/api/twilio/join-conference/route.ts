import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room") || "default_room";

  const twiml = new twilio.twiml.VoiceResponse();
  
  // Join the conference as a simple participant
  const dial = twiml.dial();
  dial.conference({
    muted: false,
    beep: "false",
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
  }, room);

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
