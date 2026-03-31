import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { z } from "zod";
import * as admin from "firebase-admin";

const emailSchema = z
  .string()
  .email("Invalid email format")
  .transform((e) => e.toLowerCase().trim());

const addAgentSchema = z.object({
  email: emailSchema,
  role: z.enum(["agent", "admin"]),
  companyId: z.string().min(1, "Company ID required"),
});

const patchAgentSchema = z.object({
  email: emailSchema,
  role: z.enum(["agent", "admin"]),
});

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("aura-session")?.value;
  if (!sessionCookie) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
  const uid = decodedClaims.uid;
  if (!uid) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return { ok: false as const, response: NextResponse.json({ error: "User not found" }, { status: 401 }) };
  }

  const userData = userDoc.data() as any;
  // Backward-compat: older data used "company_admin". Treat it as "admin" for access.
  if (userData?.role !== "admin" && userData?.role !== "company_admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (!userData?.companyId) {
    return { ok: false as const, response: NextResponse.json({ error: "Company ID missing" }, { status: 400 }) };
  }

  return { ok: true as const, uid, companyId: userData.companyId as string };
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const addedBy = auth.uid;

    const body = await request.json();
    const parsed = addAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message || "Invalid payload" }, { status: 400 });
    }

    const { email, role, companyId } = parsed.data;
    if (companyId !== auth.companyId) {
      return NextResponse.json({ error: "Company mismatch" }, { status: 403 });
    }

    const docRef = adminDb.collection("whitelist").doc(email);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return NextResponse.json({ error: "Email already whitelisted" }, { status: 400 });
    }

    await docRef.set({
      email,
      role,
      companyId,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const normalizedEmail = email.toLowerCase().trim();

    // Only allow removal within the admin's company
    const whitelistDoc = await adminDb.collection("whitelist").doc(normalizedEmail).get();
    if (whitelistDoc.exists) {
      const data = whitelistDoc.data() as any;
      if (data?.companyId && data.companyId !== auth.companyId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Delete whitelist entry
    await adminDb.collection("whitelist").doc(normalizedEmail).delete();

    // Optionally delete matching user doc(s) if they exist
    const usersSnap = await adminDb.collection("users").where("email", "==", normalizedEmail).get();
    if (!usersSnap.empty) {
      const batch = adminDb.batch();
      usersSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const parsed = patchAgentSchema.safeParse(body);
    
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    
    const { email, role } = parsed.data;

    const docRef = adminDb.collection("whitelist").doc(email);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const current = snap.data() as any;
    if (current?.companyId && current.companyId !== auth.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await docRef.update({ role });
    
    const usersSnap = await adminDb.collection("users").where("email", "==", email).get();
    if (!usersSnap.empty) {
       const userDoc = usersSnap.docs[0];
       await userDoc.ref.update({ role });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
