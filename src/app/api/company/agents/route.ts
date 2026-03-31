import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

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

  const data = userDoc.data() as any;
  // Backward-compat: older data used "company_admin". Treat it as "admin" for access.
  if (data?.role !== "admin" && data?.role !== "company_admin") {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (!data?.companyId) {
    return { ok: false as const, response: NextResponse.json({ error: "Company ID missing" }, { status: 400 }) };
  }

  return { ok: true as const, companyId: data.companyId as string };
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const now = Date.now();

    const whitelistSnap = await adminDb
      .collection("whitelist")
      .where("companyId", "==", auth.companyId)
      .get();

    const whitelist = whitelistSnap.docs.map((doc) => ({ email: doc.id, ...(doc.data() as any) }));

    const usersSnap = await adminDb.collection("users").where("companyId", "==", auth.companyId).get();
    const usersByEmail = usersSnap.docs.reduce<Record<string, any>>((acc, doc) => {
      const data = doc.data() as any;
      if (data?.email) acc[String(data.email).toLowerCase().trim()] = { uid: doc.id, ...data };
      return acc;
    }, {});

    const agents = whitelist.map((w) => {
      const key = String(w.email).toLowerCase().trim();
      const user = usersByEmail[key];

      // Status is not explicitly tracked; infer presence from lastLogin/lastSeen timestamps.
      let status: "online" | "on-call" | "offline" = "offline";
      if (user?.lastLogin) {
        const last = new Date(user.lastLogin).getTime();
        if (!Number.isNaN(last)) {
          const diffMs = now - last;
          if (diffMs <= 30 * 1000) {
            status = "online"; // active in last 30s
          } else if (diffMs <= 10 * 60 * 1000) {
            status = "on-call"; // active within last 10 minutes
          } else {
            status = "offline";
          }
        }
      }
      const addedAtIso =
        w.addedAt && typeof w.addedAt?.toDate === "function" ? w.addedAt.toDate().toISOString() : null;

      return {
        email: key,
        role: w.role,
        name: user?.displayName || user?.name || "-",
        status,
        callsHandled: user?.callsHandled ?? 0,
        addedAt: addedAtIso,
      };
    });

    return NextResponse.json(agents);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
