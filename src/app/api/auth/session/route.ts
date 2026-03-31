import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();
    
    // Verify token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const { uid, email } = decodedToken;

    if (!email) {
      return NextResponse.json({ error: "Email not found in token" }, { status: 400 });
    }

    // Check whitelist
    const whitelistDoc = await adminDb.collection("whitelist").doc(email).get();
    
    if (!whitelistDoc.exists) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { role, companyId } = whitelistDoc.data()!;

    // Create session cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    const cookieStore = await cookies();
    cookieStore.set("aura-session", sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: true, // Always true since we are using HTTPS tunnels
      sameSite: "lax",
      path: "/",
    });

    // Set a lightweight role cookie for middleware to read
    // (avoids internal fetch deadlock in Next.js dev mode)
    cookieStore.set("aura-role", role, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    // Save/update user
    await adminDb.collection("users").doc(uid).set({
      email,
      role,
      companyId,
      lastLogin: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ role, companyId });
  } catch (error: any) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: error.message || "Internal server error", stack: error.stack }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("aura-session");
  cookieStore.delete("aura-role");
  return NextResponse.json({ success: true });
}
