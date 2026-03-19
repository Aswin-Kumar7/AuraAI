import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get("CallSid") as string;
    const parentCallSid = formData.get("ParentCallSid") as string; // This links to the Agent's CallSid
    const status = formData.get("CallStatus") as string;

    console.log(`[Customer Event] ${status}: CallSid ${callSid}, Parent ${parentCallSid}`);

    if (parentCallSid) {
       const isEnded = status === "completed" || status === "busy" || status === "no-answer" || status === "failed";
       
       // 1. Update live call state for historical record/status
       await adminDb.collection("liveCallState").doc(parentCallSid).update({
          customerCallSid: callSid,
          customerStatus: status,
          status: isEnded ? "ended" : "active"
       });

       // 2. If ended, clear agent presence so dashboard returns to standby
       if (isEnded) {
          // Look up which agent was on this call (we can get this from liveCallState if needed, 
          // but usually the caller identity is the Agent UID)
          const liveSnap = await adminDb.collection("liveCallState").doc(parentCallSid).get();
          const agentId = liveSnap.data()?.agentId;
          
          if (agentId) {
             await adminDb.collection("agentPresence").doc(agentId).set({
                status: "available",
                callId: null,
                updatedAt: new Date().toISOString()
             }, { merge: true });
          }
       }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err: any) {
    console.error("Customer Event Error:", err);
    return new NextResponse("Error", { status: 500 });
  }
}
