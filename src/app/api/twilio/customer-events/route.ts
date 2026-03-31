import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { finalizeCallAndGenerateSummary } from "@/lib/call-finalization";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const callSid = formData.get("CallSid") as string;
    const parentCallSid = formData.get("ParentCallSid") as string; // This links to the Agent's CallSid
    const status = formData.get("CallStatus") as string;

    console.log(`[Customer Event] ${status}: CallSid ${callSid}, Parent ${parentCallSid}`);

    if (parentCallSid) {
       const isEnded = status === "completed" || status === "busy" || status === "no-answer" || status === "failed";
       const now = new Date().toISOString();

       await adminDb.collection("liveCallState").doc(parentCallSid).set({
          customerCallSid: callSid,
          customerStatus: status,
          lastCustomerEventAt: now,
          status: isEnded ? "completed" : "active"
       }, { merge: true });

       if (isEnded) {
          try {
            await finalizeCallAndGenerateSummary({
              callId: parentCallSid,
              endedAt: now,
              endReason: `customer-${status}`,
            });
          } catch (finalizeError) {
            console.error("[Customer Event] Finalization error:", finalizeError);

            const liveSnap = await adminDb.collection("liveCallState").doc(parentCallSid).get();
            const agentId = liveSnap.data()?.agentId;
            if (agentId) {
              await adminDb.collection("agentPresence").doc(agentId).set({
                status: "available",
                callId: null,
                incomingCall: null,
                updatedAt: now,
              }, { merge: true });
            }
          }
       }
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err: any) {
    console.error("Customer Event Error:", err);
    return new NextResponse("Error", { status: 500 });
  }
}
