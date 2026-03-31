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

const createRuleSchema = z.object({
  keyword: z.string().min(1, "Keyword required"),
  description: z.string().min(1, "Description required"),
  action: z.enum(["block", "alert", "log"]).default("alert"),
  severity: z.enum(["critical", "warning", "info"]).default("warning"),
  suggestedReplacement: z.string().optional(),
});

const updateRuleSchema = createRuleSchema.partial();

// GET: List all compliance rules for company
export async function GET(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const snap = await adminDb
      .collection("complianceRules")
      .where("companyId", "==", auth.companyId)
      .get();

    const items = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("Compliance rules GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create new compliance rule
export async function POST(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const json = await request.json();
    const parsed = createRuleSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { keyword, description, action, severity, suggestedReplacement } = parsed.data;

    const docRef = await adminDb.collection("complianceRules").add({
      companyId: auth.companyId,
      keyword: keyword.toLowerCase(),
      description,
      action,
      severity,
      suggestedReplacement: suggestedReplacement || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      id: docRef.id,
      message: "Compliance rule created successfully",
    });
  } catch (error: any) {
    console.error("Compliance rules POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update compliance rule
export async function PATCH(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }

    const json = await request.json();
    const parsed = updateRuleSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const docRef = adminDb.collection("complianceRules").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const data = docSnap.data();
    if (data?.companyId !== auth.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = { ...parsed.data };
    if (updateData.keyword) {
      updateData.keyword = updateData.keyword.toLowerCase();
    }
    updateData.updatedAt = new Date().toISOString();

    await docRef.update(updateData);

    return NextResponse.json({ message: "Compliance rule updated successfully" });
  } catch (error: any) {
    console.error("Compliance rules PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove compliance rule
export async function DELETE(request: Request) {
  try {
    const auth = await requireCompanyAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }

    const docRef = adminDb.collection("complianceRules").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const data = docSnap.data();
    if (data?.companyId !== auth.companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await docRef.delete();

    return NextResponse.json({ message: "Compliance rule deleted successfully" });
  } catch (error: any) {
    console.error("Compliance rules DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
