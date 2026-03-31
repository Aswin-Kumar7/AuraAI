import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";

const bodySchema = z.object({
  callId: z.string(),
  callerPhone: z.string(),
  note: z.string().min(1),
});

async function getContext() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("aura-session")?.value;
  if (!sessionCookie) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let uid: string | undefined;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    uid = decoded.uid;
  } catch {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!uid) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return { ok: false as const, response: NextResponse.json({ error: "User not found" }, { status: 401 }) };
  }

  const data = userDoc.data() as any;
  if (!data?.companyId) {
    return { ok: false as const, response: NextResponse.json({ error: "Company ID missing" }, { status: 400 }) };
  }

  return { ok: true as const, companyId: data.companyId as string, agentId: uid };
}

export async function POST(request: Request) {
  try {
    const ctx = await getContext();
    if (!ctx.ok) return ctx.response;

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message || "Invalid payload" }, { status: 400 });
    }

    const { callerPhone, note } = parsed.data;
    const db = adminDb;

    // 1. Update Caller Memory in Firestore (Migrating from MongoDB)
    const memoryRef = db.collection("callerMemory").doc(`${ctx.companyId}_${callerPhone}`);
    
    await memoryRef.set({
      companyId: ctx.companyId,
      phone: callerPhone,
      updatedAt: FieldValue.serverTimestamp(),
      notes: FieldValue.arrayUnion({
        agentId: ctx.agentId,
        text: note,
        createdAt: new Date().toISOString()
      })
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Memory Note Migration Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
