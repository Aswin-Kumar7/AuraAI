import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    callId: { type: String, index: true },
    agentId: { type: String, index: true },
    companyId: { type: String, index: true, required: true },
    timestamp: { type: Date, default: Date.now, index: true },

    aiSuggestion: { type: String, required: true },
    suggestionRank: { type: Number, required: true },

    agentUsed: { type: Boolean, required: true },
    agentResponse: { type: String, default: "" },
    callerMasked: { type: String, default: "" },
  },
  { timestamps: false }
);

auditLogSchema.index({ companyId: 1, timestamp: -1 });

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

