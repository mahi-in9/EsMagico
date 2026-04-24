const { createTask, getTasks } = require("../controllers/task.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = require("express").Router();
router.post("/", authMiddleware, createTask);
router.get("/", authMiddleware, getTasks);

module.exports = router;
