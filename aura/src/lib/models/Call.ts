import mongoose from "mongoose";

const callSchema = new mongoose.Schema({
  callId: { type: String, unique: true, index: true },

  agentId: { type: String, index: true },
  companyId: { type: String, index: true },

  callerPhone: String,

  transcript: [
    {
      speaker: String, // "agent" | "customer"
      text: String,
      timestamp: Date,
    },
  ],

  sentimentArc: [
    {
      score: Number,
      timestamp: Date,
    },
  ],

  duration: Number,

  status: {
    type: String,
    enum: ["active", "completed", "escalated"],
    default: "active",
  },

  summary: { type: mongoose.Schema.Types.Mixed },

  issueCategory: String,
  resolved: Boolean,

  createdAt: { type: Date, default: Date.now },
});

// Performance Indexes for fast retrieval
// 1. Compound index for Agent History queries (most common)
callSchema.index({ agentId: 1, createdAt: -1 });

// 2. Compound index for Company-wide analytics
callSchema.index({ companyId: 1, createdAt: -1 });

// 3. Search index for phone number lookup
callSchema.index({ callerPhone: 1 });

// 4. Status-based filtering
callSchema.index({ status: 1 });

export const Call = mongoose.models.Call || mongoose.model("Call", callSchema);

