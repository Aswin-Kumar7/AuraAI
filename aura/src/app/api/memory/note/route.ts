import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { connectDB } from "@/lib/mongoose";
import { CallerMemory } from "@/lib/models/CallerMemory";
import { z } from "zod";

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

    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB not configured" }, { status: 500 });
    }

    await connectDB();

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message || "Invalid payload" }, { status: 400 });
    }

    const { callId, callerPhone, note } = parsed.data;

    await CallerMemory.updateOne(
      { companyId: ctx.companyId, phone: callerPhone },
      {
        $setOnInsert: {
          callCount: 0,
          lastIssue: "",
          lastResolved: false,
        },
        $push: {
          notes: {
            agentId: ctx.agentId,
            text: note,
            createdAt: new Date(),
          },
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

