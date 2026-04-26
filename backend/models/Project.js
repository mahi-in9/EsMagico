const mongoose = require("mongoose");

const webhookLogSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  url: String,
  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    default: "pending",
  },
  attempts: { type: Number, default: 0 },
  lastAttemptAt: Date,
  payload: mongoose.Schema.Types.Mixed,
  responseStatus: Number,
});

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: { type: String, enum: ["admin", "member"], default: "member" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    inviteToken: { type: String, default: null },
    inviteTokenExpiry: { type: Date, default: null },
    webhookUrl: { type: String, default: "" },
    webhookLogs: [webhookLogSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Project", projectSchema);
