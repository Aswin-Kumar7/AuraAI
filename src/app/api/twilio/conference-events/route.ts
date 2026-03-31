import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const event = formData.get("StatusCallbackEvent") as string;
    const conferenceSid = formData.get("ConferenceSid") as string;
    const participantSid = formData.get("ParticipantSid") as string;
    const callSid = formData.get("CallSid") as string;
    const friendlyName = formData.get("FriendlyName") as string;

    console.log(`[Conference Event] ${event}: Conf ${conferenceSid}, Part ${participantSid}, Call ${callSid}`);

    if (event === "participant-join") {
       // Twilio's Outbound API call Sid will match the CallSid here if it's the customer
       // We'll store it in the liveCallState for the dashboard to read
       await adminDb.collection("liveCallState").doc(friendlyName).update({
          // If the CallSid is NOT the Agent's CallSid (which is the friendlyName), it's the customer!
          customerParticipantSid: participantSid,
          conferenceSid: conferenceSid,
          lastEvent: event
       });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err: any) {
    console.error("Conference Event Error:", err);
    return new NextResponse("Error", { status: 500 });
  }
}
