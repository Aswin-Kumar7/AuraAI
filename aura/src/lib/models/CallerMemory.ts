import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    callId: String,
    date: Date,
    issue: String,
    resolved: Boolean,
    summary: String,
  },
  { _id: false }
);

const noteSchema = new mongoose.Schema(
  {
    agentId: String,
    text: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const callerMemorySchema = new mongoose.Schema({
  phone: { type: String, required: true },
  companyId: { type: String, required: true },

  callCount: { type: Number, default: 0 },

  lastIssue: String,
  lastResolved: Boolean,

  history: [historySchema],

  notes: [noteSchema],
});

callerMemorySchema.index({ phone: 1, companyId: 1 }, { unique: true });

export const CallerMemory =
  mongoose.models.CallerMemory || mongoose.model("CallerMemory", callerMemorySchema);

