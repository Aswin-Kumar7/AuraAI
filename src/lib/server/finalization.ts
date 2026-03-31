import { adminDb, FieldValue } from "@/lib/firebase-admin";
import { updateCallerMemoryAfterCall } from "@/lib/memory";

/**
 * Maps raw intent enum values to user-friendly business category labels
 */
export function mapIntentToCategory(intent: string | undefined): string {
  if (!intent) return "General";
  
  const intentMap: Record<string, string> = {
    // Billing domain
    billing_inquiry: "Billing",
    billing_issue: "Billing",
    payment_problem: "Billing",
    invoice_question: "Billing",
    refund_request: "Billing",
    
    // Support domain  
    technical_issue: "Technical Support",
    technical_problem: "Technical Support",
    connectivity_issue: "Technical Support",
    feature_not_working: "Technical Support",
    bug_report: "Technical Support",
    
    // Service domain
    complaint: "Complaint",
    service_quality_issue: "Complaint",
    poor_service: "Complaint",
    unresolved_issue: "Complaint",
    
    // General inquiries
    general_inquiry: "General",
    information_request: "General",
    product_question: "General",
    account_question: "General",
    
    // Account domain
    account_issue: "Account",
    password_reset: "Account",
    account_access_problem: "Account",
    login_issue: "Account",
    
    // Escalations
    escalation: "Escalation",
    manager_request: "Escalation",
    legal_inquiry: "Escalation",
  };
  
  return intentMap[intent.toLowerCase()] || "General";
}

/**
 * Normalizes raw AI summary output to canonical schema expected by UI
 */
export function normalizeSummary(rawSummary: any): Record<string, any> {
  if (!rawSummary || typeof rawSummary !== "object") {
    return {
      briefSummary: "",
      customerSentiment: "Unknown",
      resolutionAction: "",
      nextSteps: [],
      callQualityScore: 0,
    };
  }

  const nextSteps = Array.isArray(rawSummary.nextSteps)
    ? rawSummary.nextSteps.map((step: unknown) => String(step || "").trim()).filter((step: string) => step.length > 0)
    : (Array.isArray(rawSummary.nextAction) ? rawSummary.nextAction : []);

  return {
    ...rawSummary,
    briefSummary:
      rawSummary.briefSummary ||
      rawSummary.issueSummary ||
      rawSummary.summary ||
      "",
    customerSentiment:
      rawSummary.customerSentiment ||
      rawSummary.sentimentArcDescription ||
      "Unknown",
    resolutionAction:
      rawSummary.resolutionAction ||
      rawSummary.resolutionSummary ||
      rawSummary.nextAction ||
      "",
    nextSteps,
    callQualityScore: Number.isFinite(Number(rawSummary.callQualityScore))
      ? Number(rawSummary.callQualityScore)
      : 0,
  };
}

/**
 * Orchestrates complete call finalization:
 * - Generates post-call summary via AI
 * - Derives category from intent + summary
 * - Normalizes summary to UI schema
 * - Persists to calls collection, caller memory, and updates agent presence
 */
export async function finalizeCall(
  callId: string,
  agentId: string,
  companyId: string,
  callerPhone?: string
) {
  try {
    console.log(`[Finalization] Starting for call ${callId}, agent ${agentId}, company ${companyId}`);

    // 1. Read live call state for transcript, sentiment, and intent
    const liveCallDoc = await adminDb.collection("liveCallState").doc(callId).get();
    const liveCallData = liveCallDoc.data() || {};

    const transcript = liveCallData.transcript || [];
    const sentimentArc = liveCallData.sentimentArc || [];
    const intent = liveCallData.intent || "general";
    const intentTrend = liveCallData.intentTrend || [];
    const phone = callerPhone || liveCallData.callerPhone || "Unknown";
    const duration = liveCallData.duration || 0;

    // 2. Generate post-call summary via AI summary endpoint
    let summary = null;
    try {
      const summaryResponse = await fetch("http://localhost:3000/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId,
          transcript,
          sentimentArc,
          detailedAnalysis: liveCallData.detailedAnalysis || {},
        }),
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = normalizeSummary(summaryData);
        console.log(`[Finalization] Summary generated for ${callId}`);
      } else {
        console.warn(`[Finalization] Summary generation failed: ${summaryResponse.status}`);
        summary = normalizeSummary(null);
      }
    } catch (error) {
      console.warn(`[Finalization] Summary generation error: ${error}`);
      summary = normalizeSummary(null);
    }

    // 3. Derive category from intent trend + summary
    const lastIntent = intentTrend && intentTrend.length > 0
      ? intentTrend[intentTrend.length - 1]
      : intent;
    
    const issueCategory = mapIntentToCategory(lastIntent);

    // 4. Determine if resolved based on summary and sentiment
    const finalSentiment = sentimentArc && sentimentArc.length > 0
      ? sentimentArc[sentimentArc.length - 1]
      : {};
    const sentiment = finalSentiment.sentiment || "neutral";
    
    const resolved = 
      (summary.resolutionAction && summary.resolutionAction.toLowerCase().includes("resolved")) ||
      sentiment === "positive";

    // 5. Persist to calls collection
    const callRef = adminDb.collection("calls").doc(callId);
    await callRef.set({
      transcript,
      sentimentArc,
      summary,
      issueCategory,
      intent: lastIntent,
      intentTrend,
      agentId,
      companyId,
      callerPhone: phone,
      duration,
      resolved,
      endedAt: new Date().toISOString(),
      // Preserve any existing fields
    }, { merge: true });

    console.log(`[Finalization] Call ${callId} persisted to calls collection`);

    // 6. Update caller memory (includes profile summary generation)
    if (phone && phone !== "Unknown") {
      try {
        await updateCallerMemoryAfterCall({
          companyId,
          phone,
          callId,
          issue: issueCategory,
          resolved,
          summary: summary.briefSummary || "",
        });
        console.log(`[Finalization] Caller memory updated for ${phone}`);
      } catch (error) {
        console.warn(`[Finalization] Caller memory update error: ${error}`);
      }
    }

    // 7. Update agent presence to available
    const agentPresenceRef = adminDb.collection("agentPresence").doc(agentId);
    await agentPresenceRef.set({
      status: "available",
      updateTime: new Date().toISOString(),
      lastCallId: callId,
    }, { merge: true });

    console.log(`[Finalization] Agent ${agentId} marked as available`);

    // 8. Clean up live call state (keep as historical record with endedAt marker)
    await adminDb.collection("liveCallState").doc(callId).set({
      endedAt: new Date().toISOString(),
      finalized: true,
    }, { merge: true });

    return {
      success: true,
      callId,
      issueCategory,
      resolved,
      summary,
    };
  } catch (error) {
    console.error(`[Finalization] Error finalizing call ${callId}:`, error);
    throw error;
  }
}

/**
 * Safely finalize a call by callId, looking up required agent/company context
 * Used when we only have callId (e.g., from Twilio webhook)
 */
export async function finalizeCallByIdWithLookup(callId: string) {
  try {
    // Try to find call in liveCallState first
    const liveSnap = await adminDb.collection("liveCallState").doc(callId).get();
    if (!liveSnap.exists) {
      throw new Error(`Call ${callId} not found in liveCallState`);
    }

    const liveData = liveSnap.data();
    const agentId = liveData?.agentId;
    const companyId = liveData?.companyId;
    const callerPhone = liveData?.callerPhone;

    if (!agentId || !companyId) {
      throw new Error(`Missing agentId or companyId for call ${callId}`);
    }

    return await finalizeCall(callId, agentId, companyId, callerPhone);
  } catch (error) {
    console.error(`[Finalization] Lookup error for ${callId}:`, error);
    throw error;
  }
}
