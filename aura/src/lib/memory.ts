import { adminDb, FieldValue } from "./firebase-admin";

export type CallerHistoryEntry = {
  callId?: string;
  date?: string;
  issue?: string;
  resolved?: boolean;
  summary?: string;
};

function normalizeCallerHistory(history: unknown[]): CallerHistoryEntry[] {
  return history
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .map((entry) => {
      const issue = typeof entry.issue === "string" ? entry.issue.trim() : undefined;

      return {
        callId: typeof entry.callId === "string" ? entry.callId : undefined,
        date: typeof entry.date === "string" ? entry.date : undefined,
        issue,
        resolved: typeof entry.resolved === "boolean" ? entry.resolved : undefined,
        summary: typeof entry.summary === "string" ? entry.summary : undefined,
      };
    });
}

function unresolvedRate(entries: CallerHistoryEntry[]): number {
  if (entries.length === 0) return 0;
  const unresolved = entries.filter((entry) => entry.resolved === false).length;
  return unresolved / entries.length;
}

export function buildProfileSummaryFromHistory(history: CallerHistoryEntry[]): string {
  const sortedHistory = history
    .map((entry, index) => ({
      ...entry,
      _index: index,
      _dateMs: entry.date ? Date.parse(entry.date) : Number.NaN,
    }))
    .sort((a, b) => {
      const aHasDate = Number.isFinite(a._dateMs);
      const bHasDate = Number.isFinite(b._dateMs);

      if (aHasDate && bHasDate) return a._dateMs - b._dateMs;
      if (aHasDate) return -1;
      if (bHasDate) return 1;

      return a._index - b._index;
    });

  const recent = sortedHistory.slice(-8);
  if (recent.length === 0) {
    return "Top issue: n/a (0/0). Unresolved: 0/0. Latest issue: n/a. Trend: no history yet.";
  }

  const issueCounts = new Map<string, number>();
  for (const entry of recent) {
    const key = entry.issue && entry.issue.length > 0 ? entry.issue : "Unspecified issue";
    issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
  }

  let topIssue = "Unspecified issue";
  let topIssueCount = 0;
  for (const entry of [...recent].reverse()) {
    const key = entry.issue && entry.issue.length > 0 ? entry.issue : "Unspecified issue";
    const count = issueCounts.get(key) ?? 0;
    if (count > topIssueCount) {
      topIssue = key;
      topIssueCount = count;
    }
  }

  const unresolvedCount = recent.filter((entry) => entry.resolved === false).length;
  const latestIssue = recent[recent.length - 1]?.issue || "Unspecified issue";

  const latestWindow = recent.slice(-3);
  const previousWindow = recent.slice(Math.max(0, recent.length - 6), Math.max(0, recent.length - 3));
  const latestRate = unresolvedRate(latestWindow);
  const previousRate = unresolvedRate(previousWindow);

  let trendText = "mixed";
  if (latestWindow.length <= 1) {
    trendText = "limited history";
  } else if (latestRate === 0 && unresolvedCount === 0) {
    trendText = "improving";
  } else if (previousWindow.length === 0) {
    trendText = latestRate > 0.5 ? "needs attention" : "mixed";
  } else if (latestRate > previousRate + 0.2) {
    trendText = "worsening";
  } else if (latestRate < previousRate - 0.2) {
    trendText = "improving";
  } else {
    trendText = "stable";
  }

  return `Top issue: ${topIssue} (${topIssueCount}/${recent.length}). Unresolved: ${unresolvedCount}/${recent.length}. Latest issue: ${latestIssue}. Trend: ${trendText}.`;
}

export async function getRepeatCallerSummary(companyId: string, phone: string) {
  const memDoc = await adminDb.collection("callerMemory")
    .where("companyId", "==", companyId)
    .where("phone", "==", phone)
    .limit(1).get();

  if (memDoc.empty) {
    return { isRepeatCaller: false, callCount: 0, history: [] as CallerHistoryEntry[] };
  }

  const doc = memDoc.docs[0].data();
  const history = Array.isArray(doc.history)
    ? normalizeCallerHistory(doc.history).slice(-3)
    : [];

  return {
    isRepeatCaller: (doc.callCount || 0) > 0,
    callCount: doc.callCount || 0,
    history,
  };
}

interface PostCallUpdateInput {
  companyId: string;
  phone: string;
  callId: string;
  issue: string;
  resolved: boolean;
  summary: string;
}

export async function updateCallerMemoryAfterCall(input: PostCallUpdateInput) {
  const { companyId, phone, callId, issue, resolved, summary } = input;

  // Find existing or create new doc ID by hashing companyId + phone or use query
  const memQuery = await adminDb.collection("callerMemory")
    .where("companyId", "==", companyId)
    .where("phone", "==", phone)
    .limit(1).get();

  const memRef = memQuery.empty
    ? adminDb.collection("callerMemory").doc()
    : memQuery.docs[0].ref;

  await memRef.set({
    companyId,
    phone,
    callCount: FieldValue.increment(1),
    lastIssue: issue,
    lastResolved: resolved,
    history: FieldValue.arrayUnion({
      callId,
      date: new Date().toISOString(),
      issue,
      resolved,
      summary,
    })
  }, { merge: true });

  const updatedSnapshot = await memRef.get();
  const updatedData = updatedSnapshot.data();
  const updatedHistory = Array.isArray(updatedData?.history)
    ? normalizeCallerHistory(updatedData.history)
    : [];

  const profileSummary = buildProfileSummaryFromHistory(updatedHistory);
  await memRef.set(
    {
      profileSummary,
      profileUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

