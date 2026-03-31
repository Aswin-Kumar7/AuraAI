import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { z } from "zod";

const configSchema = z.object({
  companyName: z.string().optional(),
  voiceId: z.string().optional(),
  knowledgeBase: z.string().max(50000).optional(),
  complianceKeywords: z.array(z.string().min(1)).optional(),
  alertThreshold: z.number().min(0).max(100).optional(),
  language: z.enum(["en", "hi", "hinglish", "auto"]).optional(),
});

async function requireCompanyContext() {
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

  return { ok: true as const, companyId: data.companyId as string };
}

export async function GET() {
  try {
    const auth = await requireCompanyContext();
    if (!auth.ok) return auth.response;

    const doc = await adminDb.collection("companyConfig").doc(auth.companyId).get();
    const base = {
      companyName: "",
      voiceId: "",
      knowledgeBase: "",
      complianceKeywords: [] as string[],
      alertThreshold: 50,
      language: "en" as const,
    };

    if (!doc.exists) {
      return NextResponse.json(base);
    }

    return NextResponse.json({ ...base, ...(doc.data() as any) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireCompanyContext();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message || "Invalid payload" }, { status: 400 });
    }

    const update = parsed.data;
    await adminDb.collection("companyConfig").doc(auth.companyId).set(update, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

