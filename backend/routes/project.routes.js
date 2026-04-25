const {
  createProject,
  getProjects,
  getProjectById,
} = require("../controllers/project.controller");
const { createTask, getTasks } = require("../controllers/task.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = require("express").Router();
router.post("/", authMiddleware, createProject);
router.get("/", authMiddleware, getProjects);
router.get("/:id", authMiddleware, getProjectById);
router.post("/:id/task", authMiddleware, createTask);
router.get("/:id/task", authMiddleware, getTasks);

module.exports = router;
