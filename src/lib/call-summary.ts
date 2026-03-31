import { adminDb } from "@/lib/firebase-admin";
import { callGroq } from "@/lib/groq";
import { updateCallerMemoryAfterCall } from "@/lib/memory";
import { buildSummaryPrompt } from "@/lib/prompts";
import { deriveIssueCategory } from "@/lib/call-categorization";

type TranscriptLine = {
  speaker: string;
  text: string;
  timestamp?: string;
};

type SentimentPoint = {
  score: number;
  timestamp: string;
};

export type CanonicalSummary = {
  issueCategory: string;
  issueSummary: string;
  resolutionStatus: string;
  resolutionSummary: string;
  nextAction: string;
  sentimentArcDescription: string;
  briefSummary: string;
  customerSentiment: string;
  resolutionAction: string;
  nextSteps: string[];
  callQualityScore: number;
};

function coerceTranscript(value: unknown): TranscriptLine[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((line) => {
      const entry = (line || {}) as Record<string, unknown>;
      return {
        speaker: String(entry.speaker || "customer").toLowerCase(),
        text: String(entry.text || "").trim(),
        timestamp: entry.timestamp ? String(entry.timestamp) : undefined,
      };
    })
    .filter((line) => line.text.length > 0);
}

function coerceSentimentArc(value: unknown): SentimentPoint[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((point) => {
      const entry = (point || {}) as Record<string, unknown>;
      const score = Number(entry.score);
      if (!Number.isFinite(score)) return null;
      const timestamp = entry.timestamp ? String(entry.timestamp) : new Date().toISOString();
      return { score: Math.round(score), timestamp };
    })
    .filter((point): point is SentimentPoint => !!point);
}

function pickFirstString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 5);
}

function normalizeQualityScore(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 0) return 0;

  // Some models return 0-100. Normalize to 1-5 for UI consistency.
  if (numeric > 5) {
    return Math.min(5, Math.max(1, Math.round(numeric / 20)));
  }
  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function parseSummaryJson(groqText: string | null): Record<string, unknown> {
  if (!groqText) return {};
  try {
    return JSON.parse(groqText) as Record<string, unknown>;
  } catch (error) {
    console.error("Failed to parse summary JSON", error, groqText);
    return {};
  }
}

function isResolved(summary: CanonicalSummary, existingResolved: boolean): boolean {
  if (existingResolved) return true;
  const text = `${summary.resolutionStatus} ${summary.resolutionSummary} ${summary.resolutionAction}`.toLowerCase();
  return /(resolved|completed|fixed|closed|done|refunded|processed)/i.test(text);
}

export function buildCanonicalSummaryPayload(
  summaryJson: Record<string, unknown>,
  fallbackCategory: string
): CanonicalSummary {
  const issueSummary = pickFirstString([
    summaryJson.issueSummary,
    summaryJson.briefSummary,
    summaryJson.summary,
  ]);
  const resolutionSummary = pickFirstString([
    summaryJson.resolutionSummary,
    summaryJson.resolutionAction,
    summaryJson.nextAction,
  ]);
  const resolutionStatus = pickFirstString([
    summaryJson.resolutionStatus,
    summaryJson.resolution,
    summaryJson.status,
  ]);
  const nextAction = pickFirstString([
    summaryJson.nextAction,
    summaryJson.resolutionAction,
  ]);

  const briefSummary = pickFirstString([
    summaryJson.briefSummary,
    issueSummary,
    resolutionSummary,
    nextAction,
  ]);
  const customerSentiment = pickFirstString([
    summaryJson.customerSentiment,
    summaryJson.sentimentLabel,
    summaryJson.sentimentArcDescription,
    "neutral",
  ]);
  const resolutionAction = pickFirstString([
    summaryJson.resolutionAction,
    resolutionSummary,
    nextAction,
  ]);
  const sentimentArcDescription = pickFirstString([
    summaryJson.sentimentArcDescription,
    summaryJson.customerSentiment,
  ]);

  let nextSteps = toStringArray(summaryJson.nextSteps);
  if (nextSteps.length === 0 && nextAction) {
    nextSteps = [nextAction];
  }

  return {
    issueCategory: fallbackCategory,
    issueSummary,
    resolutionStatus,
    resolutionSummary,
    nextAction,
    sentimentArcDescription,
    briefSummary,
    customerSentiment,
    resolutionAction,
    nextSteps,
    callQualityScore: normalizeQualityScore(summaryJson.callQualityScore),
  };
}

export async function generateAndPersistCallSummary(input: {
  callId: string;
  companyId?: string;
}) {
  const { callId } = input;
  const liveRef = adminDb.collection("liveCallState").doc(callId);
  const callRef = adminDb.collection("calls").doc(callId);

  const [liveSnap, callSnap] = await Promise.all([liveRef.get(), callRef.get()]);
  if (!liveSnap.exists && !callSnap.exists) {
    throw new Error("Call not found");
  }

  const liveData = (liveSnap.data() || {}) as Record<string, unknown>;
  const callData = (callSnap.data() || {}) as Record<string, unknown>;
  const mergedData = { ...callData, ...liveData } as Record<string, unknown>;

  const transcript = coerceTranscript(liveData.transcript ?? callData.transcript);
  const sentimentArc = coerceSentimentArc(liveData.sentimentArc ?? callData.sentimentArc);
  const companyId = String(input.companyId || mergedData.companyId || "").trim();

  let companyName = "";
  if (companyId) {
    const configSnap = await adminDb.collection("companyConfig").doc(companyId).get();
    companyName = String((configSnap.data() || {}).companyName || "");
  }

  const summaryPrompt = buildSummaryPrompt(transcript, sentimentArc, companyName);
  const systemPrompt = `
You summarize completed phone calls for supervisors.
You MUST respond with a single valid JSON object.
Do not include markdown or extra text.
`;
  const groqText = await callGroq(systemPrompt, summaryPrompt, 800);
  const summaryJson = parseSummaryJson(groqText);

  const fallbackCategory = deriveIssueCategory({
    explicitIssueCategory: String(summaryJson.issueCategory || ""),
    intent: String(mergedData.intent || ""),
    intentTrend: mergedData.intentTrend,
    issueSummary: String(summaryJson.issueSummary || ""),
  });

  const summaryPayload = buildCanonicalSummaryPayload(summaryJson, fallbackCategory);
  const resolved = isResolved(summaryPayload, Boolean(mergedData.resolved));

  const updateData = {
    summary: summaryPayload,
    issueCategory: summaryPayload.issueCategory,
    resolved,
    status: "completed",
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    callRef.set(updateData, { merge: true }),
    liveRef.set(updateData, { merge: true }),
  ]);

  const phone = String(mergedData.callerPhone || "").trim();
  if (phone && companyId) {
    await updateCallerMemoryAfterCall({
      companyId,
      phone,
      callId,
      issue: summaryPayload.issueCategory || summaryPayload.issueSummary,
      resolved,
      summary: summaryPayload.briefSummary || summaryPayload.resolutionSummary,
    });
  }

  return {
    callId,
    summary: summaryPayload,
    issueCategory: summaryPayload.issueCategory,
    resolved,
    usedModelSummary: !!groqText,
  };
}
