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

    // Fetch last 100 calls from Firestore 'calls' collection
    const snapshot = await adminDb.collection("calls")
      .where("agentId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    // Group by callerPhone in-memory (since Firestore lacks $group)
    const contactMap: Record<string, any> = {};

    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const phone = data.callerPhone || "Unknown";
      
      if (!contactMap[phone]) {
        contactMap[phone] = {
          phone,
          callCount: 0,
          lastCallAt: data.createdAt,
          lastIssue: data.issueCategory,
          summaries: []
        };
      }
      
      contactMap[phone].callCount++;
      if (data.summary?.briefSummary) {
        contactMap[phone].summaries.push(data.summary.briefSummary);
      }
    });

    const contacts = Object.values(contactMap).slice(0, 50);

    const mappedContacts = contacts.map((c: any) => ({
      ...c,
      name: `Customer User#${Math.floor(Math.random() * 9000) + 1000}`,
      summaries: c.summaries.filter(Boolean), 
    }));

    return NextResponse.json({ contacts: mappedContacts });
  } catch (error: any) {
    console.error("Contacts error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
