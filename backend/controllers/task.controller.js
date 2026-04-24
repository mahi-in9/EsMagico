const Task = require("../models/Task");

const createTask = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }
    const task = await Task.create(req.body);
    res
      .status(201)
      .json({ success: true, message: "Task created", data: task });
  } catch (error) {
    next(error);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const tasks = await Task.find({
      $or: [{ user: userId }, { projectId: req.params.projectId }],
    });
    if (!tasks) throw new Error("Tasks not found");
    res
      .status(200)
      .json({ success: true, message: "Tasks fetched", data: tasks });
  } catch (error) {
    next(error);
  }
};

module.exports = { createTask, getTasks };
