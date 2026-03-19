import { NextResponse } from "next/server";
import twilio from "twilio";
import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";

let cachedNumbers: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("aura-session")?.value;
    
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (cachedNumbers && Date.now() - cacheTimestamp < CACHE_TTL) {
      return NextResponse.json({ numbers: cachedNumbers });
    }

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Fetch in parallel to cut latency in half
    const [verifiedCallerIds, incomingPhoneNumbers] = await Promise.all([
      client.outgoingCallerIds.list({ limit: 20 }),
      client.incomingPhoneNumbers.list({ limit: 20 })
    ]);
    
    const accessibleNumbers = [
      ...verifiedCallerIds.map(v => ({ phone: v.phoneNumber, name: v.friendlyName, type: 'Verified' })),
      ...incomingPhoneNumbers.map(n => ({ phone: n.phoneNumber, name: n.friendlyName, type: 'Purchased' }))
    ];

    const uniqueNumbers = Array.from(new Map(accessibleNumbers.map(item => [item.phone, item])).values());
    
    cachedNumbers = uniqueNumbers;
    cacheTimestamp = Date.now();

    return NextResponse.json({ numbers: uniqueNumbers });
  } catch (error: any) {
    console.error("Twilio caller IDs error:", error);
    return NextResponse.json({ error: "Failed to fetch Twilio caller IDs" }, { status: 500 });
  }
}
