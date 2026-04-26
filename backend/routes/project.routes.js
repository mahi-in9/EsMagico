const express = require("express");
const {
  createProject,
  getProjects,
  getProjectById,
  generateInvite,
  joinProject,
  updateWebhook,
  getAuditLogs,
} = require("../controllers/project.controller");
const {
  createTask,
  getTasks,
  getTaskById,
  getTaskHistory,
  updateTask,
  updateTaskStatus,
  retryTask,
  deleteTask,
  computeExecution,
  simulate,
} = require("../controllers/task.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// Project routes (all protected)
router.post("/", authMiddleware, createProject);
router.get("/", authMiddleware, getProjects);
router.get("/:id", authMiddleware, getProjectById);
router.post("/:id/invite", authMiddleware, generateInvite);
router.post("/join/:token", authMiddleware, joinProject);
router.put("/:id/webhook", authMiddleware, updateWebhook);
router.get("/:id/audit-logs", authMiddleware, getAuditLogs);

// Execution & Simulation
router.post("/:id/compute-execution", authMiddleware, computeExecution);
router.post("/:id/simulate", authMiddleware, simulate);

// Task routes nested under project
router.post("/:id/task", authMiddleware, createTask);
router.get("/:id/task", authMiddleware, getTasks);
router.get("/:id/task/:taskId", authMiddleware, getTaskById);
router.get("/:id/task/:taskId/history", authMiddleware, getTaskHistory);
router.put("/:id/task/:taskId", authMiddleware, updateTask);
router.patch("/:id/task/:taskId/status", authMiddleware, updateTaskStatus);
router.post("/:id/task/:taskId/retry", authMiddleware, retryTask);
router.delete("/:id/task/:taskId", authMiddleware, deleteTask);

module.exports = router;
