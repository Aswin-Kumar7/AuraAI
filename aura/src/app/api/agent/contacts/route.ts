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
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const uid = await requireAgentContext();
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First, fetch stored custom contact names from agentContacts collection
    const customContactsSnap = await adminDb.collection("agentContacts").doc(uid).collection("contacts").get();
    const customContacts: Record<string, { name: string; callCount?: number; lastCallAt?: string; lastIssue?: string; summaries?: string[] }> = {};

    customContactsSnap.docs.forEach((doc) => {
      const data = doc.data();
      customContacts[doc.id] = {
        name: data.name,
        callCount: data.callCount || 0,
        lastCallAt: data.lastCallAt || "",
        lastIssue: data.lastIssue || "",
        summaries: data.summaries || [],
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
        summary?: { briefSummary?: string };
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
      if (data.summary?.briefSummary) {
        contactMap[phone].summaries.push(data.summary.briefSummary);
      }
    });

    const contacts = Object.values(contactMap).slice(0, 50);

    const mappedContacts = contacts.map((c) => {
      const contact = c as {
        phone: string;
        callCount: number;
        lastCallAt: string;
        lastIssue: string;
        summaries: string[];
      };

      // Use custom name if it exists, otherwise generate a fake one
      const customContact = customContacts[contact.phone];
      const name = customContact?.name || `Customer User#${Math.floor(Math.random() * 9000) + 1000}`;

      return {
        ...contact,
        name,
        summaries: (contact.summaries || []).filter(Boolean),
      };
    });

    return NextResponse.json({ contacts: mappedContacts });
  } catch (error) {
    console.error("Contacts error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const uid = await requireAgentContext();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const uid = await requireAgentContext();
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
