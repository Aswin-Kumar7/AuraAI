import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

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

export async function GET(request: Request) {
  try {
    const auth = await requireAgentContext();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let query: any = adminDb.collection("calls")
      .where("agentId", "==", auth.agentId)
      .orderBy("createdAt", "desc");

    if (status) {
       query = query.where("status", "==", status);
    }

    // Firestore doesn't support complex regex search like Mongo without a 3rd party
    // So we'll fetch then filter for search if requested, or keep it simple
    
    const snapshot = await query.get();
    let calls = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    if (search) {
      const lowerSearch = search.toLowerCase();
      calls = calls.filter((c: any) => 
        (c.callerPhone?.toLowerCase().includes(lowerSearch)) ||
        (c.issueCategory?.toLowerCase().includes(lowerSearch))
      );
    }

    const total = calls.length;
    const paginatedCalls = calls.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      calls: paginatedCalls,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error("Error fetching agent calls:", error);
    return NextResponse.json({ 
       error: "Internal server error", 
       details: error.message 
    }, { status: 500 });
  }
}