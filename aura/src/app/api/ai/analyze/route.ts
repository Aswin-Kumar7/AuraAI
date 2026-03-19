import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb, FieldValue } from "@/lib/firebase-admin";
import { z } from "zod";
import { callGroq } from "@/lib/groq";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "@/lib/prompts";
import { retrieveRelevantKB } from "@/lib/rag";
// Removed MongoDB imports for Firestore migration
import { TranscriptLine } from "@/store/callStore"; 

const bodySchema = z.object({
  callId: z.string(),
  newLine: z.object({
    speaker: z.string(),
    text: z.string(),
    timestamp: z.string().or(z.date()),
  }),
  companyConfig: z.object({
    companyName: z.string().optional(),
    complianceKeywords: z.array(z.string()).optional().default([]),
    alertThreshold: z.number().optional().default(0.3),
  }).optional(),
  callerMemory: z.union([
    z.object({
      callCount: z.number(),
      lastIssue: z.string(),
      lastResolved: z.boolean(),
    }),
    z.string(), // Allow "N/A" string from ws-server
  ]).optional(),
});

async function getUserContext(req: Request) {
  const internalSecret = req.headers.get("x-internal-secret");
  const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || "aura_internal_prod_secret_123";

  if (internalSecret === INTERNAL_API_SECRET) {
    // For internal system calls, we bypass session validation to drop latency
    return { ok: true as const, uid: "system", companyId: "aura-demo-id" };
  }

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

  const userDoc = await adminDb.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return { ok: false as const, response: NextResponse.json({ error: "User not found" }, { status: 401 }) };
  }

  const data = userDoc.data() as any;
  if (!data?.companyId) {
    return { ok: true as const, uid, companyId: "aura-demo-id" }; // Fallback for testing
  }

  return { ok: true as const, uid, companyId: data.companyId as string };
}

export async function POST(request: Request) {
  try {
    const ctx = await getUserContext(request);
    if (!ctx.ok) return ctx.response;

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message || "Invalid payload" }, { status: 400 });
    }

    const { callId, newLine, companyConfig: demoConfig, callerMemory: demoMemory } = parsed.data;
    const isDemo = callId.startsWith("demo-call-");

    let transcript: { speaker: string; text: string; timestamp?: any }[] = [];
    let companyId: string = ctx.companyId;
    let callerPhone: string | undefined;

    if (isDemo) {
      // For demo, use provided transcript or build it
      transcript = []; // Demo will send full transcript
      companyId = ctx.companyId;
    } else {
      // 1. Firestore liveCallState/{callId}
      const liveRef = adminDb.collection("liveCallState").doc(callId);
      const liveSnap = await liveRef.get();
      if (!liveSnap.exists) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      const liveData = liveSnap.data() as any;

      transcript = liveData?.transcript || [];
      companyId = liveData.companyId || ctx.companyId;
      callerPhone = liveData.callerPhone;
    }

    let lastAnalyzedAt: number = 0;
    let liveRef: any;
    let liveData: any;

    if (isDemo) {
      // For demo, no rate limit
    } else {
      liveRef = adminDb.collection("liveCallState").doc(callId);
      const liveSnap = await liveRef.get();
      if (!liveSnap.exists) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      liveData = liveSnap.data() as any;
      lastAnalyzedAt = liveData.lastAnalyzedAt || 0;
    }

    const updatedTranscript = [...transcript, newLine];

    // 3. Rate limit (skip for demo)
    const now = Date.now();
    if (!isDemo && lastAnalyzedAt && now - lastAnalyzedAt < 2000) {
      // still append transcript but skip analysis
      await liveRef.update({ transcript: updatedTranscript });
      return NextResponse.json({ skipped: true });
    }

    // 2. Company config
    const configSnap = await adminDb.collection("companyConfig").doc(companyId).get();
    const config = (configSnap.data() as any) || {};
    const complianceKeywords: string[] = demoConfig?.complianceKeywords || config.complianceKeywords || [];
    const alertThreshold: number = demoConfig?.alertThreshold ?? (typeof config.alertThreshold === "number" ? config.alertThreshold : 70);
    const language: "en" | "hi" | "hinglish" | "auto" =
      config.language || "en";

    // 4. Extract last customer message & last lines
    const lastLines = updatedTranscript.slice(-6);
    const lastCustomer =
      [...updatedTranscript].reverse().find((l) => l.speaker === "customer") ||
      lastLines[lastLines.length - 1];
    const lastCustomerMessage = lastCustomer?.text || "";

    // 5. RAG
    const kbChunks = lastCustomerMessage
      ? await retrieveRelevantKB(companyId, lastCustomerMessage)
      : [];

    // Caller history from Firestore
    let callerHistory: any[] | null = null;
    if (demoMemory && typeof demoMemory === "object") {
      callerHistory = [{
        callId: "demo-call",
        date: new Date(),
        issue: (demoMemory as any).lastIssue,
        resolved: (demoMemory as any).lastResolved,
        summary: `Previous call about ${(demoMemory as any).lastIssue}`
      }];
    } else if (callerPhone) {
      const memDoc = await adminDb.collection("callerMemory")
        .where("companyId", "==", companyId)
        .where("phone", "==", callerPhone)
        .limit(1).get();
        
      if (!memDoc.empty) {
        const mem = memDoc.docs[0].data();
        if (Array.isArray(mem.history)) {
          callerHistory = mem.history.slice(-3);
        }
      }
    }

    // 6. Build prompts
    const systemPrompt = buildAnalysisSystemPrompt(
      kbChunks,
      complianceKeywords,
      language,
      callerHistory
    );
    const userPrompt = buildAnalysisUserPrompt(lastLines);

    // 7. Call Groq
    const groqText = await callGroq(systemPrompt, userPrompt, 800);

    // 8. Parse JSON safely
    let parsedAi: any = {};
    if (groqText) {
      try {
        parsedAi = JSON.parse(groqText);
      } catch (e) {
        console.error("Failed to parse Groq JSON", e, groqText);
        parsedAi = {};
      }
    }

    const sentiment: number =
      typeof parsedAi.sentiment === "number" ? parsedAi.sentiment : 50;
    const sentimentLabel: string =
      parsedAi.sentimentLabel || "calm";

    const suggestions: any[] = Array.isArray(parsedAi.suggestions)
      ? parsedAi.suggestions.slice(0, 3)
      : [];

    const complianceAlert: boolean = !!parsedAi.complianceAlert;
    const complianceReason: string = parsedAi.complianceReason || "";
    const knowledgeSnippet: string = parsedAi.knowledgeSnippet || "";

    const detectedLanguage: string = parsedAi.detectedLanguage || language;
    const liveSummary: string = parsedAi.liveSummary || "";

    const mode =
      sentiment < alertThreshold || complianceAlert ? "alert" : "normal";

    // 9. Update Firestore liveCallState (skip for demo)
    if (!isDemo) {
      await liveRef.set(
      {
        transcript: updatedTranscript,
        sentimentScore: sentiment,
        sentimentLabel,
        // Atomic push to the arc for graphing
        sentimentArc: FieldValue.arrayUnion({
           score: sentiment,
           timestamp: new Date().toISOString()
        }),
        currentSuggestions: suggestions,
        complianceAlert,
        complianceReason,
        knowledgeSnippet,
        detectedLanguage,
        liveSummary,
        lastAnalyzedAt: now,
        activeMode: mode,
      },
      { merge: true }
    );
    }

    // 11. Persistent Audit Log (Firestore)
    if (!isDemo && suggestions.length > 0) {
      const batch = adminDb.batch();
      suggestions.forEach((s, idx) => {
        const auditRef = adminDb.collection("auditLogs").doc();
        batch.set(auditRef, {
          callId,
          agentId: ctx.uid,
          companyId,
          timestamp: new Date().toISOString(),
          aiSuggestion: String(s.text || ""),
          suggestionRank: s.rank || idx + 1,
          agentUsed: false,
          agentResponse: "",
          callerMasked: callerPhone || "Anonymous",
        });
      });
      await batch.commit();
    }

    // 12. Return JSON
    return NextResponse.json({
      callId,
      sentiment,
      sentimentLabel,
      suggestions,
      complianceAlert,
      complianceReason,
      knowledgeSnippet,
      detectedLanguage,
      mode,
      skipped: false,
    });
  } catch (error: any) {
    console.error("AI analyze error", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
        fallback: true,
      },
      { status: 500 }
    );
  }
}

