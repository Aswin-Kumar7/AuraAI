const INTENT_CATEGORY_MAP: Record<string, string> = {
  billing_issue: "Billing",
  product_issue: "Product Support",
  return_request: "Returns and Refunds",
  technical_issue: "Technical Support",
  complaint: "Complaint",
  general_inquiry: "General Inquiry",
  escalation: "Escalation",
  other: "General Inquiry",
};

const ISSUE_KEYWORD_MAP: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /(refund|return|money back|chargeback)/i, category: "Returns and Refunds" },
  { pattern: /(bill|invoice|charge|payment|subscription|pricing)/i, category: "Billing" },
  { pattern: /(bug|error|not work|issue|failed|broken|login|otp|password)/i, category: "Technical Support" },
  { pattern: /(complaint|manager|supervisor|unhappy|bad service|escalat)/i, category: "Complaint" },
  { pattern: /(product|feature|plan|policy|coverage)/i, category: "Product Support" },
];

export function normalizeIntent(intent: string | null | undefined): string {
  return String(intent || "").trim().toLowerCase();
}

function isPlaceholderCategory(category: string | null | undefined): boolean {
  const normalized = String(category || "").trim().toLowerCase();
  if (!normalized) return true;
  return ["undisclosed", "uncategorized", "categorizing...", "n/a", "na", "unknown"].includes(normalized);
}

export function mapIntentToCategory(intent: string | null | undefined): string {
  const normalizedIntent = normalizeIntent(intent);
  return INTENT_CATEGORY_MAP[normalizedIntent] || "General Inquiry";
}

type IntentTrendPoint = {
  intent?: string;
  timestamp?: string;
};

export function latestIntentFromTrend(intentTrend: unknown): string {
  if (!Array.isArray(intentTrend) || intentTrend.length === 0) return "";

  const points = intentTrend
    .map((point) => {
      const entry = point as IntentTrendPoint;
      return {
        intent: normalizeIntent(entry?.intent),
        timestamp: String(entry?.timestamp || ""),
      };
    })
    .filter((point) => point.intent.length > 0)
    .sort((a, b) => Date.parse(a.timestamp || "") - Date.parse(b.timestamp || ""));

  if (points.length === 0) return "";
  return points[points.length - 1].intent;
}

function categoryFromIssueText(issueText: string): string {
  for (const item of ISSUE_KEYWORD_MAP) {
    if (item.pattern.test(issueText)) {
      return item.category;
    }
  }
  return "General Inquiry";
}

export function deriveIssueCategory(input: {
  explicitIssueCategory?: string | null;
  intent?: string | null;
  intentTrend?: unknown;
  issueSummary?: string | null;
}): string {
  const explicit = String(input.explicitIssueCategory || "").trim();
  if (!isPlaceholderCategory(explicit)) {
    return explicit;
  }

  const directIntent = normalizeIntent(input.intent);
  if (directIntent) {
    return mapIntentToCategory(directIntent);
  }

  const trendIntent = latestIntentFromTrend(input.intentTrend);
  if (trendIntent) {
    return mapIntentToCategory(trendIntent);
  }

  const summaryText = String(input.issueSummary || "").trim();
  if (summaryText) {
    return categoryFromIssueText(summaryText);
  }

  return "General Inquiry";
}
