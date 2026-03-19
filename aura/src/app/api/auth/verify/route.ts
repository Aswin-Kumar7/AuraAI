import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("aura-session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    
    // Fetch role
    const userDoc = await adminDb.collection("users").doc(decodedClaims.uid).get();
    if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const { role } = userDoc.data()!;

    return NextResponse.json({ role });
  } catch (error: any) {
    console.error("Verification error:", error);
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}
