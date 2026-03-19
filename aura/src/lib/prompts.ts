type SentimentLabel = "calm" | "tense" | "frustrated" | "escalating" | "resolved";

export function buildAnalysisSystemPrompt(
  kbChunks: string[],
  complianceKeywords: string[],
  language: "en" | "hi" | "hinglish" | "auto",
  callerHistory: any[] | null
) {
  const kbText = kbChunks.join("\n---\n");
  const historyText =
    callerHistory && callerHistory.length
      ? callerHistory
          .map(
            (h, idx) =>
              `#${idx + 1} Date: ${h.date || ""}, Issue: ${h.issue || ""}, Resolved: ${
                h.resolved ? "yes" : "no"
              }, Summary: ${h.summary || ""}`
          )
          .join("\n")
      : "No prior history.";

  const keywords = complianceKeywords.join(", ");

  return `
You are Aura's real-time call analysis engine.

CRITICAL RULES:
- You MUST respond with a SINGLE JSON object only.
- DO NOT include markdown, explanations, or any text outside the JSON.
- The JSON MUST be syntactically valid and parseable with JSON.parse.
- Strings must use double quotes. Do NOT include trailing commas.

Use this company knowledge base to ground your suggestions:
${kbText || "No additional KB provided."}

Compliance keywords to watch for (high risk topics):
${keywords || "None specified"}

Caller history:
${historyText}

Target language setting: ${language}.
You may detect the caller's language automatically but ALWAYS encode detectedLanguage as one of: "en", "hi", "hinglish".

You must return JSON in the EXACT shape:
{
  "intent": string,
  "sentiment": number,
  "sentimentLabel": "calm" | "tense" | "frustrated" | "escalating" | "resolved",
  "suggestions": [
    { "text": string, "tone": string, "rank": 1 },
    { "text": string, "tone": string, "rank": 2 },
    { "text": string, "tone": string, "rank": 3 }
  ],
  "knowledgeSnippet": string,
  "complianceAlert": boolean,
  "complianceReason": string,
  "liveSummary": string,
  "detectedLanguage": "en" | "hi" | "hinglish"
}

Guidance:
- sentiment: numeric score, e.g. 0-100, higher = more positive.
- sentimentLabel: classify the current moment.
- suggestions: three distinct next responses the agent could say, ranked 1 (best) to 3.
- knowledgeSnippet: short extract from KB that justifies the best suggestion.
- complianceAlert: true if conversation touches any compliance keyword or escalation risk.
- complianceReason: brief explanation when complianceAlert is true, else empty string.
- liveSummary: a 1-sentence summary of the current call status (English).
`;
}

export function buildAnalysisUserPrompt(lastLines: { speaker: string; text: string }[]) {
  const recent = lastLines.slice(-6);
  const formatted = recent
    .map((l) => `${l.speaker === "agent" ? "Agent" : "Customer"}: ${l.text}`)
    .join("\n");

  return `Here is the most recent part of the call transcript (chronological order):

${formatted}

Analyze ONLY these lines in the context of the system instructions and return the JSON response described there.`;
}

export function buildSummaryPrompt(
  transcript: { speaker: string; text: string }[],
  sentimentArc: { score: number; timestamp: string | Date }[],
  companyName: string
) {
  const transcriptText = transcript
    .map((l) => `${l.speaker === "agent" ? "Agent" : "Customer"}: ${l.text}`)
    .join("\n");

  const sentimentText = sentimentArc
    .map((p) => `t=${new Date(p.timestamp).toISOString()}, score=${p.score}`)
    .join("\n");

  return `
You are Aura's post-call summarization engine for ${companyName || "the company"}.

Return ONLY valid JSON, with no markdown and no extra text.

Transcript:
${transcriptText}

Sentiment arc points:
${sentimentText}

Respond with a single JSON object:
{
  "issueCategory": string,
  "issueSummary": string,
  "resolutionStatus": string,
  "resolutionSummary": string,
  "nextAction": string,
  "sentimentArcDescription": string,
  "callQualityScore": number
}

Make sure the JSON is syntactically valid and contains all fields.`;
}

