import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { z } from "zod";

async function requireCompanyAdmin() {
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

  const data = userDoc.data() as any;
  if (data?.role !== "admin" && data?.role !== "company_admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (!data?.companyId) {
    return { ok: false as const, response: NextResponse.json({ error: "Company ID missing" }, { status: 400 }) };
  }

  return { ok: true as const, companyId: data.companyId as string };
}

const createKBSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().min(1),
  language: z.enum(["en", "hi", "hinglish"]).default("en"),
  tags: z.array(z.string()).optional().default([]),
});

const updateKBSchema = createKBSchema.partial().required({ content: true });

// GET: List all KB entries for company
export async function GET(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const language = searchParams.get("language");

    let query = adminDb.collection("companyKB").where("companyId", "==", auth.companyId);

    if (category) {
      query = query.where("category", "==", category);
    }
    if (language) {
      query = query.where("language", "==", language);
    }

    const snap = await query.get();
    const items = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("KB GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create new KB entry
export async function POST(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const json = await request.json();
    const parsed = createKBSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { title, content, category, language, tags } = parsed.data;

    const docRef = await adminDb.collection("companyKB").add({
      companyId: auth.companyId,
      title,
      content,
      category,
      language,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      id: docRef.id,
      message: "KB entry created successfully",
    });
  } catch (error: any) {
    console.error("KB POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update KB entry
export async function PATCH(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "KB ID required" }, { status: 400 });
    }

    const json = await request.json();
    const parsed = updateKBSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const docRef = adminDb.collection("companyKB").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "KB entry not found" }, { status: 404 });
    }

    const data = docSnap.data();
    if (data?.companyId !== auth.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await docRef.update({
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ message: "KB entry updated successfully" });
  } catch (error: any) {
    console.error("KB PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove KB entry
export async function DELETE(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "KB ID required" }, { status: 400 });
    }

    const docRef = adminDb.collection("companyKB").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "KB entry not found" }, { status: 404 });
    }

    const data = docSnap.data();
    if (data?.companyId !== auth.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await docRef.delete();

    return NextResponse.json({ message: "KB entry deleted successfully" });
  } catch (error: any) {
    console.error("KB DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
