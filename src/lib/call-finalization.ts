import { adminDb } from "@/lib/firebase-admin";
import { generateAndPersistCallSummary } from "@/lib/call-summary";

type FinalizeInput = {
  callId: string;
  endedAt?: string;
  companyId?: string;
  agentId?: string;
  endReason?: string;
};

function parseDateSafe(value: unknown): number {
  if (!value) return 0;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function deriveDurationSeconds(input: {
  createdAt?: unknown;
  endedAt: string;
  existingDuration?: unknown;
}): number {
  const existingDuration = Number(input.existingDuration);
  if (Number.isFinite(existingDuration) && existingDuration > 0) {
    return Math.round(existingDuration);
  }

  const createdMs = parseDateSafe(input.createdAt);
  const endedMs = parseDateSafe(input.endedAt);
  if (!createdMs || !endedMs || endedMs <= createdMs) return 0;

  return Math.max(0, Math.round((endedMs - createdMs) / 1000));
}

export async function finalizeCallAndGenerateSummary(input: FinalizeInput) {
  const { callId } = input;
  const endedAt = input.endedAt || new Date().toISOString();

  const liveRef = adminDb.collection("liveCallState").doc(callId);
  const callRef = adminDb.collection("calls").doc(callId);

  const [liveSnap, callSnap] = await Promise.all([liveRef.get(), callRef.get()]);
  if (!liveSnap.exists && !callSnap.exists) {
    throw new Error("Call not found");
  }

  const liveData = (liveSnap.data() || {}) as Record<string, unknown>;
  const callData = (callSnap.data() || {}) as Record<string, unknown>;
  const mergedData = { ...callData, ...liveData } as Record<string, unknown>;

  const companyId = String(input.companyId || mergedData.companyId || "").trim();
  const agentId = String(input.agentId || mergedData.agentId || "").trim();
  const callerPhone = String(mergedData.callerPhone || "").trim();
  const duration = deriveDurationSeconds({
    createdAt: mergedData.createdAt,
    endedAt,
    existingDuration: mergedData.duration,
  });

  const transcript = Array.isArray(liveData.transcript)
    ? liveData.transcript
    : Array.isArray(callData.transcript)
      ? callData.transcript
      : [];
  const sentimentArc = Array.isArray(liveData.sentimentArc)
    ? liveData.sentimentArc
    : Array.isArray(callData.sentimentArc)
      ? callData.sentimentArc
      : [];

  const baseUpdate = {
    status: "completed",
    endedAt,
    updatedAt: endedAt,
    activeMode: "auto",
    duration,
    companyId: companyId || null,
    agentId: agentId || null,
    callerPhone: callerPhone || null,
    transcript,
    sentimentArc,
    ...(input.endReason ? { endReason: input.endReason } : {}),
  };

  await Promise.all([
    liveRef.set(baseUpdate, { merge: true }),
    callRef.set(baseUpdate, { merge: true }),
  ]);

  if (agentId) {
    await adminDb.collection("agentPresence").doc(agentId).set(
      {
        status: "available",
        callId: null,
        incomingCall: null,
        updatedAt: endedAt,
      },
      { merge: true }
    );
  }

  const summaryResult = await generateAndPersistCallSummary({
    callId,
    companyId: companyId || undefined,
  });

  return {
    finalizedAt: endedAt,
    duration,
    ...summaryResult,
  };
}
