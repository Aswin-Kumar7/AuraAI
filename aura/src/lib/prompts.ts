type SentimentLabel = "calm" | "tense" | "frustrated" | "escalating" | "resolved";

export function buildAnalysisSystemPrompt(
  kbChunks: string[],
  complianceKeywords: string[],
  language: "en" | "hi" | "hinglish" | "auto",
  callerHistory: any[] | null,
  complianceRules?: string
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

COMPLIANCE RULES TO STRICTLY ENFORCE:
${complianceRules || "No compliance rules configured."}
Flag ANY conversation containing these keywords or violations. ALWAYS provide compliant alternatives.

Legacy compliance keywords to watch for (high risk topics):
${keywords || "None specified"}

Caller history:
${historyText}

Target language setting: ${language}.
You may detect the caller's language automatically but ALWAYS encode detectedLanguage as one of: "en", "hi", "hinglish".

You must return JSON in the EXACT shape:
{
  "intent": "billing_issue" | "product_issue" | "return_request" | "technical_issue" | "complaint" | "general_inquiry" | "escalation" | "other",
  "isPreviousIssue": boolean,
  "sentiment": number,
  "sentimentLabel": "calm" | "tense" | "frustrated" | "escalating" | "resolved",
  "escalationRisk": number,
  "escalationReason": string,
  "interventionSuggestion": string,
  "suggestions": [
    { "text": string, "tone": string, "rank": 1 },
    { "text": string, "tone": string, "rank": 2 },
    { "text": string, "tone": string, "rank": 3 }
  ],
  "knowledgeSnippet": string,
  "complianceAlert": boolean,
  "complianceReason": string,
  "complianceSeverity": "critical" | "warning" | "info",
  "liveSummary": string,
  "detectedLanguage": "en" | "hi" | "hinglish"
}

Guidance:
- intent: Classify the customer's primary goal. Check caller history to set isPreviousIssue=true if this is a repeat issue.
- isPreviousIssue: true if caller has called before with the same or similar issue, false otherwise.
- sentiment: numeric score, e.g. 0-100, higher = more positive.
- sentimentLabel: classify the current moment.
- escalationRisk: score 0-1. Calculate based on: frustration level, number of times issue repeated, if they asked for manager, if sentiment declining. 0.0=no risk, 1.0=immediate escalation.
- escalationReason: concise explanation of why escalation risk is high (e.g., "Customer frustrated on 3rd repeat of same issue").
- interventionSuggestion: If escalationRisk > 0.5, suggest de-escalation action (e.g., "Offer to escalate to manager", "Provide immediate compensation").
- suggestions: three distinct next responses the agent could say, ranked 1 (best) to 3. If escalationRisk > 0.5, rank de-escalation responses higher.
- knowledgeSnippet: short extract from KB that justifies the best suggestion.
- complianceAlert: true if conversation contains any compliance keyword OR agent is about to violate script/policy.
- complianceReason: brief explanation when complianceAlert is true, else empty string. If agent said something risky, explain what and suggest correction.
- complianceSeverity: "critical" if blocking a violation, "warning" if risky, "info" if informational.
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

