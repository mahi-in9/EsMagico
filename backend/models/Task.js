const mongoose = require("mongoose");

const taskVersionSchema = new mongoose.Schema({
  versionNumber: { type: Number, required: true },
  title: String,
  description: String,
  priority: Number,
  estimatedHours: Number,
  status: String,
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
  resourceTag: String,
  maxRetries: Number,
  retryCount: Number,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now },
});

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    priority: { type: Number, min: 1, max: 5, default: 3 },
    estimatedHours: { type: Number, required: true, default: 1, min: 0.1 },
    status: {
      type: String,
      enum: ["Pending", "Running", "Completed", "Failed", "Blocked"],
      default: "Pending",
    },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    resourceTag: { type: String, default: "" },
    maxRetries: { type: Number, default: 3, min: 0 },
    retryCount: { type: Number, default: 0, min: 0 },
    versionNumber: { type: Number, default: 1 },
    versionHistory: [taskVersionSchema],
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
