import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, adminDb, FieldValue } from "@/lib/firebase-admin";
import { z } from "zod";
import { callGroq } from "@/lib/groq";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from "@/lib/prompts";
import { retrieveRelevantKB } from "@/lib/rag";

type TranscriptLine = { speaker: string; text: string; timestamp?: string | Date };
type CallerHistoryEntry = { callId: string; date: string; issue: string; resolved: boolean; summary: string; };


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

  const data = userDoc.data() as { companyId?: string } | undefined;
  const companyId = data?.companyId || "aura-demo-id";

  return { ok: true as const, uid, companyId };
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

    type LiveCallStateDoc = {
      transcript?: TranscriptLine[];
      companyId?: string;
      callerPhone?: string;
      lastAnalyzedAt?: number;
    };

    let transcript: TranscriptLine[] = [];
    let companyId: string = ctx.companyId;
    let callerPhone: string | undefined;

    let liveRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> | null = null;
    let liveData: LiveCallStateDoc | null = null;

    if (isDemo) {
      transcript = [];
      companyId = ctx.companyId;
    } else {
      liveRef = adminDb.collection("liveCallState").doc(callId);
      const liveSnap = await liveRef.get();
      if (!liveSnap.exists) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }

      liveData = liveSnap.data() as LiveCallStateDoc;
      transcript = liveData?.transcript || [];
      companyId = liveData.companyId || ctx.companyId;
      callerPhone = liveData.callerPhone;
    }

    let lastAnalyzedAt: number = 0;

    if (isDemo) {
      // For demo, no rate limit
    } else {
      if (!liveRef) {
        liveRef = adminDb.collection("liveCallState").doc(callId);
      }
      const liveSnap = await liveRef.get();
      if (!liveSnap.exists) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      liveData = liveSnap.data() as LiveCallStateDoc;
      lastAnalyzedAt = liveData.lastAnalyzedAt || 0;
    }

    const updatedTranscript = [...transcript, newLine];

    // 3. Rate limit (skip for demo)
    const now = Date.now();
    if (!isDemo && lastAnalyzedAt && now - lastAnalyzedAt < 2000) {
      // still append transcript but skip analysis
      if (!liveRef) {
        return NextResponse.json({ error: "Call reference lost" }, { status: 500 });
      }
      await liveRef.update({ transcript: updatedTranscript });
      return NextResponse.json({ skipped: true });
    }

    // 2. Company config
    const configSnap = await adminDb.collection("companyConfig").doc(companyId).get();
    const config = (configSnap.data() as {
      complianceKeywords?: string[];
      alertThreshold?: number;
      language?: "en" | "hi" | "hinglish" | "auto";
    } | undefined) || {};
    const complianceKeywords: string[] = demoConfig?.complianceKeywords || config.complianceKeywords || [];
    const alertThreshold: number = demoConfig?.alertThreshold ?? (typeof config.alertThreshold === "number" ? config.alertThreshold : 70);
    const language: "en" | "hi" | "hinglish" | "auto" =
      config.language || "en";

    // 2b. Fetch compliance rules from Firestore
    let complianceRulesText = "";
    if (!isDemo) {
      const rulesSnap = await adminDb.collection("complianceRules")
        .where("companyId", "==", companyId)
        .get();
      
      if (!rulesSnap.empty) {
        complianceRulesText = rulesSnap.docs
          .map((doc) => {
            const rule = doc.data();
            return `- KEYWORD: "${rule.keyword}" | SEVERITY: ${rule.severity} | REASON: ${rule.description} | SUGGEST: "${rule.suggestedReplacement || 'Avoid this phrase'}"`;
          })
          .join("\n");
      }
    }

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
    let callerHistory: CallerHistoryEntry[] | null = null;
    if (demoMemory && typeof demoMemory === "object" && "lastIssue" in demoMemory && "lastResolved" in demoMemory) {
      const dm = demoMemory as { lastIssue: string; lastResolved: boolean };
      callerHistory = [{
        callId: "demo-call",
        date: new Date().toISOString(),
        issue: dm.lastIssue,
        resolved: dm.lastResolved,
        summary: `Previous call about ${dm.lastIssue}`
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
      callerHistory,
      complianceRulesText
    );
    const userPrompt = buildAnalysisUserPrompt(lastLines);

    // 7. Call Groq
    const groqText = await callGroq(systemPrompt, userPrompt, 800);

    // 8. Parse JSON safely
    type AiResponse = {
      intent?: string;
      isPreviousIssue?: boolean;
      sentiment?: number;
      sentimentLabel?: string;
      escalationRisk?: number;
      escalationReason?: string;
      interventionSuggestion?: string;
      suggestions?: Array<{ text?: string; tone?: string; rank?: number }>;
      complianceAlert?: boolean;
      complianceReason?: string;
      complianceSeverity?: string;
      knowledgeSnippet?: string;
      detectedLanguage?: string;
      liveSummary?: string;
    };

    let parsedAi: AiResponse = {};
    if (groqText) {
      try {
        parsedAi = JSON.parse(groqText) as AiResponse;
      } catch (e: unknown) {
        console.error("Failed to parse Groq JSON", e, groqText);
        parsedAi = {};
      }
    }

    const intent: string = parsedAi.intent || "general_inquiry";
    const isPreviousIssue: boolean = !!parsedAi.isPreviousIssue;
    const sentiment: number =
      typeof parsedAi.sentiment === "number" ? parsedAi.sentiment : 50;
    const sentimentLabel: string =
      parsedAi.sentimentLabel || "calm";
    const escalationRisk: number =
      typeof parsedAi.escalationRisk === "number" ? Math.min(Math.max(parsedAi.escalationRisk, 0), 1) : 0;
    const escalationReason: string = parsedAi.escalationReason || "";
    const interventionSuggestion: string = parsedAi.interventionSuggestion || "";

    const suggestions = Array.isArray(parsedAi.suggestions)
      ? parsedAi.suggestions.slice(0, 3)
      : [];

    const complianceAlert: boolean = !!parsedAi.complianceAlert;
    const complianceReason: string = parsedAi.complianceReason || "";
    const complianceSeverity: string = parsedAi.complianceSeverity || "warning";
    const knowledgeSnippet: string = parsedAi.knowledgeSnippet || "";

    const detectedLanguage: string = parsedAi.detectedLanguage || language;
    const liveSummary: string = parsedAi.liveSummary || "";

    // Determine mode: alert if compliance issue, escalation risk > 0.6, or low sentiment
    const mode =
      complianceAlert || escalationRisk > 0.6 || sentiment < alertThreshold ? "alert" : "whisper";

    // 9. Update Firestore liveCallState (skip for demo)
    if (!isDemo) {
      if (!liveRef) {
        return NextResponse.json({ error: "Call reference lost" }, { status: 500 });
      }
      await liveRef.set(
      {
        transcript: updatedTranscript,
        intent,
        isPreviousIssue,
        sentimentScore: sentiment,
        sentimentLabel,
        escalationRisk,
        escalationReason,
        interventionSuggestion,
        // Atomic push to the arc for graphing
        sentimentArc: FieldValue.arrayUnion({
           score: sentiment,
           timestamp: new Date().toISOString()
        }),
        currentSuggestions: suggestions,
        complianceAlert,
        complianceReason,
        complianceSeverity,
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
      intent,
      isPreviousIssue,
      sentiment,
      sentimentLabel,
      escalationRisk,
      escalationReason,
      interventionSuggestion,
      suggestions,
      complianceAlert,
      complianceReason,
      complianceSeverity,
      knowledgeSnippet,
      detectedLanguage,
      mode,
      skipped: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("AI analyze error", error);
    return NextResponse.json(
      {
        error: message,
        fallback: true,
      },
      { status: 500 }
    );
  }
}

