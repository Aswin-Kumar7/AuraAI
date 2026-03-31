import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
// Removed MongoDB imports for Firestore migration

async function requireAgentContext() {
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

  return { ok: true as const, agentId: uid };
}

export async function GET() {
  try {
    const auth = await requireAgentContext();
    if (!auth.ok) return auth.response;

    // Fetch from Firestore 'users' collection
    const userDoc = await adminDb.collection("users").doc(auth.agentId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    return NextResponse.json({
      name: userData?.name || "Agent",
      email: userData?.email || "",
      uid: userDoc.id,
      companyId: userData?.companyId
    });
  } catch (error: any) {
    console.error("Error fetching agent profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAgentContext();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    // Update in Firestore 'users' collection
    await adminDb.collection("users").doc(auth.agentId).update({
       name: name.trim(),
       updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (error: any) {
    console.error("Error updating agent profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}