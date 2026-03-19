import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { z } from "zod";
import { Pinecone } from "@pinecone-database/pinecone";
import crypto from "crypto";

const schema = z.object({
  kbText: z.string().max(50000),
});

async function getCompanyIdFromSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("aura-session")?.value;
  if (!sessionCookie) return null;
  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  const uid = decoded.uid;
  if (!uid) return null;
  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) return null;
  const data = userDoc.data() as any;
  return data?.companyId as string | undefined;
}

function chunkText(text: string, chunkSize = 800, overlap = 100) {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - overlap;
  }
  return chunks;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const kbText = parsed.data.kbText.trim();
    const companyId = await getCompanyIdFromSession();
    if (!companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
      return NextResponse.json({ error: "Vector store not configured" }, { status: 500 });
    }

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(process.env.PINECONE_INDEX);

    const chunks = chunkText(kbText);

    // Simple deterministic IDs per chunk
    const vectors = chunks.map((chunk, i) => ({
      id: crypto
        .createHash("sha1")
        .update(`${companyId}:${i}:${chunk.slice(0, 32)}`)
        .digest("hex")
        .slice(0, 32),
      values: new Array(768).fill(0), // placeholder; real embedding pipeline should replace this
      metadata: {
        companyId,
        text: chunk,
      },
    }));

    await index.upsert({ records: vectors });

    // Save raw KB to Firestore
    await adminDb.collection("companyConfig").doc(companyId).set(
      {
        knowledgeBase: kbText,
      },
      { merge: true }
    );

    return NextResponse.json({ chunksIndexed: chunks.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

