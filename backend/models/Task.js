const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },

    priority: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },

    estimatedHours: {
      type: Number,
      required: true,
      default: 1,
    },

    status: {
      type: String,
      enum: ["Pending", "Running", "Completed", "Failed", "Blocked"],
      default: "Pending",
    },

    dependencies: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],

    resourceTag: {
      type: String,
      default: "",
    },

    maxRetries: {
      type: Number,
      default: 3,
    },

    retryCount: {
      type: Number,
      default: 0,
    },

    versionNumber: {
      type: Number,
      default: 1,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Task", taskSchema);
