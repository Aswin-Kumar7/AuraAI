import { adminDb, FieldValue } from "./firebase-admin";

export async function getRepeatCallerSummary(companyId: string, phone: string) {
  const memDoc = await adminDb.collection("callerMemory")
    .where("companyId", "==", companyId)
    .where("phone", "==", phone)
    .limit(1).get();

  if (memDoc.empty) {
    return { isRepeatCaller: false, callCount: 0, history: [] as any[] };
  }

  const doc = memDoc.docs[0].data();
  const history = Array.isArray(doc.history) ? doc.history.slice(-3) : [];

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

  let memRef;
  if (memQuery.empty) {
    memRef = adminDb.collection("callerMemory").doc();
  } else {
    memRef = memQuery.docs[0].ref;
  }

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
}

