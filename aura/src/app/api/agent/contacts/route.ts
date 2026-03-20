import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
// Removed MongoDB imports for Firestore migration

async function requireAgentContext() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("aura-session")?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;
    if (!uid) return null;

    const userSnap = await adminDb.collection("users").doc(uid).get();
    const companyId = userSnap.data()?.companyId;
    if (!companyId) return null;

    return { uid, companyId: String(companyId) };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const ctx = await requireAgentContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { uid, companyId } = ctx;

    // First, fetch stored custom contact names from agentContacts collection
    const customContactsSnap = await adminDb.collection("agentContacts").doc(uid).collection("contacts").get();
    const customContacts: Record<string, {
      name: string;
      callCount?: number;
      lastCallAt?: string;
      lastIssue?: string;
      summaries?: string[];
      profileSummary?: string;
    }> = {};

    customContactsSnap.docs.forEach((doc) => {
      const data = doc.data();
      customContacts[doc.id] = {
        name: data.name,
        callCount: data.callCount || 0,
        lastCallAt: data.lastCallAt || "",
        lastIssue: data.lastIssue || "",
        summaries: data.summaries || [],
        profileSummary: data.profileSummary || "",
      };
    });

    // Fetch last 100 calls from Firestore 'calls' collection
    const snapshot = await adminDb.collection("calls")
      .where("agentId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    // Group by callerPhone in-memory (since Firestore lacks $group)
    type ContactMapEntry = {
      phone: string;
      callCount: number;
      lastCallAt: string;
      lastIssue: string;
      summaries: string[];
    };
    const contactMap: Record<string, ContactMapEntry> = {};

    snapshot.docs.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => {
      const data = doc.data() as {
        callerPhone?: string;
        createdAt?: string;
        issueCategory?: string;
        summary?: any;
      };
      const phone = data.callerPhone || "Unknown";
      
      if (!contactMap[phone]) {
        contactMap[phone] = {
          phone,
          callCount: 0,
          lastCallAt: data.createdAt || "",
          lastIssue: data.issueCategory || "",
          summaries: []
        };
      }
      
      contactMap[phone].callCount++;
      const briefSummary =
        data.summary?.briefSummary ||
        data.summary?.issueSummary ||
        data.summary?.resolutionSummary ||
        "";

      if (briefSummary) {
        contactMap[phone].summaries.push(briefSummary);
      }
    });

    const memorySnap = await adminDb
      .collection("callerMemory")
      .where("companyId", "==", companyId)
      .limit(300)
      .get();

    const memoryByPhone: Record<string, {
      callCount: number;
      lastCallAt: string;
      lastIssue: string;
      summaries: string[];
      profileSummary: string;
    }> = {};

    memorySnap.docs.forEach((doc) => {
      const data = doc.data() as {
        phone?: string;
        callCount?: number;
        lastIssue?: string;
        history?: Array<{ date?: string; summary?: string }>;
        profileSummary?: string;
      };

      const phone = String(data.phone || "").trim();
      if (!phone) return;

      const history = Array.isArray(data.history) ? data.history : [];
      const sortedHistory = [...history].sort(
        (a, b) => Date.parse(String(b?.date || "")) - Date.parse(String(a?.date || ""))
      );

      memoryByPhone[phone] = {
        callCount: Number(data.callCount || 0),
        lastIssue: String(data.lastIssue || ""),
        lastCallAt: String(sortedHistory[0]?.date || ""),
        summaries: sortedHistory
          .map((entry) => String(entry?.summary || "").trim())
          .filter((summary) => summary.length > 0)
          .slice(0, 6),
        profileSummary: String(data.profileSummary || ""),
      };
    });

    const allPhones = new Set<string>([
      ...Object.keys(contactMap),
      ...Object.keys(customContacts),
      ...Object.keys(memoryByPhone),
    ]);

    const mappedContacts = Array.from(allPhones).map((phone) => {
      const fromCalls = contactMap[phone] || {
        phone,
        callCount: 0,
        lastCallAt: "",
        lastIssue: "",
        summaries: [],
      };

      const fromCustom = customContacts[phone] || {
        name: "",
        callCount: 0,
        lastCallAt: "",
        lastIssue: "",
        summaries: [],
        profileSummary: "",
      };

      const fromMemory = memoryByPhone[phone] || {
        callCount: 0,
        lastCallAt: "",
        lastIssue: "",
        summaries: [],
        profileSummary: "",
      };

      const uniqueSummaries = Array.from(
        new Set<string>([
          ...fromCalls.summaries,
          ...(fromCustom.summaries || []),
          ...fromMemory.summaries,
        ].filter((value) => value && value.trim().length > 0))
      ).slice(0, 6);

      const digits = phone.replace(/\D/g, "");
      const fallbackName = digits.length >= 4
        ? `Customer ${digits.slice(-4)}`
        : "Customer";

      return {
        phone,
        name: fromCustom.name || fallbackName,
        callCount: Math.max(
          fromCalls.callCount,
          Number(fromCustom.callCount || 0),
          fromMemory.callCount
        ),
        lastCallAt: fromCalls.lastCallAt || fromMemory.lastCallAt || String(fromCustom.lastCallAt || ""),
        lastIssue: fromCalls.lastIssue || fromMemory.lastIssue || String(fromCustom.lastIssue || ""),
        summaries: uniqueSummaries,
        profileSummary: fromMemory.profileSummary || String(fromCustom.profileSummary || ""),
      };
    })
      .sort((a, b) => Date.parse(b.lastCallAt || "") - Date.parse(a.lastCallAt || ""))
      .slice(0, 50);

    return NextResponse.json({ contacts: mappedContacts });
  } catch (error) {
    console.error("Contacts error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireAgentContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { uid } = ctx;

    const body = await request.json();
    const contact = body.contact;
    if (!contact?.phone || !contact?.name) {
      return NextResponse.json({ error: "Missing name or phone" }, { status: 400 });
    }

    await adminDb.collection("agentContacts").doc(uid).collection("contacts").doc(contact.phone).set({
      name: contact.name,
      phone: contact.phone,
      callCount: contact.callCount ?? 0,
      lastCallAt: contact.lastCallAt || "",
      lastIssue: contact.lastIssue || "",
      summaries: contact.summaries || [],
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contacts POST error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireAgentContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { uid } = ctx;

    const body = await request.json();
    const phone = body.phone;
    const name = body.name;

    if (!phone || !name) {
      return NextResponse.json({ error: "Missing phone or name" }, { status: 400 });
    }

    const contactRef = adminDb.collection("agentContacts").doc(uid).collection("contacts").doc(phone);
    await contactRef.set({ name, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contacts PATCH error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
