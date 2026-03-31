import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

export async function POST(request: NextRequest) {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // High quality AI voice for the hold instruction
  twiml.say({ voice: 'Polly.Joanna' }, "Please stay on the line while I look into this for you. Your call is important to us.");
  
  // Loop some soft music after the instruction
  twiml.play("http://twimlets.com/holdmusic?bucket=com.twilio.music.soft");

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
