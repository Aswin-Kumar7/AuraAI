import mongoose from "mongoose";

const agentSchema = new mongoose.Schema({
  uid: { type: String, unique: true, required: true },

  companyId: { type: String, index: true },
  email: String,
  name: String,

  sensitivityOverride: Number,

  stats: {
    callsToday: { type: Number, default: 0 },
    callsWeek: { type: Number, default: 0 },
    avgAHT: { type: Number, default: 0 },
    avgCSAT: { type: Number, default: 0 },
    suggestionsUsedRate: { type: Number, default: 0 },
    escalationsAvoided: { type: Number, default: 0 },
  },
});

export const Agent = mongoose.models.Agent || mongoose.model("Agent", agentSchema);

