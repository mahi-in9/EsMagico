const Task = require("../models/Task");
const Project = require("../models/Project");

// Helper: detect cycles using DFS
const hasCycle = (taskId, dependencies, allTasks) => {
  const visited = new Set();

  const dfs = (currentId) => {
    if (visited.has(currentId.toString())) return true;
    visited.add(currentId.toString());

    const task = allTasks.find(
      (t) => t._id.toString() === currentId.toString(),
    );
    if (!task) return false;

    for (const depId of task.dependencies) {
      if (dfs(depId.toString())) return true;
    }
    return false;
  };

  for (const depId of dependencies) {
    if (depId.toString() === taskId.toString()) return true; // self-dependency
    if (dfs(depId.toString())) return true;
  }
  return false;
};

const createTask = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const {
      title,
      description,
      priority,
      estimatedHours,
      resourceTag,
      maxRetries,
      dependencies,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    // Verify project exists and user is a member
    const project = await Project.findById(projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    const userId = req.user._id.toString();
    const isMember =
      project.owner.toString() === userId ||
      project.members.some((m) => m.user.toString() === userId);

    if (!isMember) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Validate dependencies exist in this project
    if (dependencies && dependencies.length > 0) {
      const projectTasks = await Task.find({ projectId });

      // Cycle detection — temporarily treat new task as having these deps
      const tempTask = {
        _id: "new",
        dependencies: dependencies,
      };
      const allTasksForCheck = [...projectTasks, tempTask];

      if (hasCycle("new", dependencies, allTasksForCheck)) {
        return res.status(400).json({
          success: false,
          message:
            "Cyclic dependency detected. This dependency would create a cycle.",
        });
      }
    }

    const task = await Task.create({
      title,
      description,
      priority: priority || 3,
      estimatedHours: estimatedHours || 1,
      resourceTag: resourceTag || "",
      maxRetries: maxRetries || 3,
      dependencies: dependencies || [],
      projectId,
      user: req.user._id,
    });

    // Add task reference to project
    project.tasks.push(task._id);
    await project.save();

    res.status(201).json({
      success: true,
      message: "Task created",
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const projectId = req.params.id; // BUG FIX: was req.params.projectId

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // BUG FIX: fetch ALL project tasks, not just the current user's tasks
    // All members should see all tasks in the project
    const tasks = await Task.find({ projectId }).populate(
      "dependencies",
      "title status",
    );

    res.status(200).json({
      success: true,
      message: "Tasks fetched",
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const {
      title,
      description,
      priority,
      estimatedHours,
      resourceTag,
      maxRetries,
      dependencies,
      versionNumber, // Client must send this for optimistic concurrency
    } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Optimistic concurrency check — reject stale updates
    if (versionNumber !== undefined && task.versionNumber !== versionNumber) {
      return res.status(409).json({
        success: false,
        message:
          "Update conflict: this task was modified by someone else. Please refresh and try again.",
        latestData: task,
      });
    }

    // Validate dependencies for cycles if they changed
    if (dependencies && dependencies.length > 0) {
      const projectTasks = await Task.find({ projectId: task.projectId });
      const otherTasks = projectTasks.filter(
        (t) => t._id.toString() !== task._id.toString(),
      );
      const tempTask = { _id: task._id, dependencies };

      if (hasCycle(task._id, dependencies, [...otherTasks, tempTask])) {
        return res.status(400).json({
          success: false,
          message: "Cyclic dependency detected.",
        });
      }
    }

    // Apply updates
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
    if (resourceTag !== undefined) task.resourceTag = resourceTag;
    if (maxRetries !== undefined) task.maxRetries = maxRetries;
    if (dependencies !== undefined) task.dependencies = dependencies;

    // Increment version on every update
    task.versionNumber += 1;

    await task.save();

    res.status(200).json({
      success: true,
      message: "Task updated",
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

const updateTaskStatus = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const validStatuses = [
      "Pending",
      "Running",
      "Completed",
      "Failed",
      "Blocked",
    ];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Enforce Running constraints
    if (status === "Running") {
      // All dependencies must be Completed
      if (task.dependencies.length > 0) {
        const depTasks = await Task.find({ _id: { $in: task.dependencies } });
        const allDepsCompleted = depTasks.every(
          (d) => d.status === "Completed",
        );
        if (!allDepsCompleted) {
          return res.status(400).json({
            success: false,
            message: "Cannot run task: not all dependencies are completed.",
          });
        }
      }

      // No other task with same resourceTag can be Running
      if (task.resourceTag) {
        const conflicting = await Task.findOne({
          projectId: task.projectId,
          resourceTag: task.resourceTag,
          status: "Running",
          _id: { $ne: task._id },
        });
        if (conflicting) {
          return res.status(400).json({
            success: false,
            message: `Resource conflict: task "${conflicting.title}" is already running with tag "${task.resourceTag}".`,
          });
        }
      }
    }

    task.status = status;
    task.versionNumber += 1;
    await task.save();

    res.status(200).json({
      success: true,
      message: "Task status updated",
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

const retryTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId);

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    if (task.status !== "Failed") {
      return res
        .status(400)
        .json({ success: false, message: "Only failed tasks can be retried" });
    }

    if (task.retryCount >= task.maxRetries) {
      return res.status(400).json({
        success: false,
        message: `Max retries (${task.maxRetries}) reached. Cannot retry further.`,
      });
    }

    task.retryCount += 1;
    task.status = "Pending";
    task.versionNumber += 1;
    await task.save();

    res.status(200).json({
      success: true,
      message: `Task queued for retry (attempt ${task.retryCount}/${task.maxRetries})`,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId);

    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    await Task.findByIdAndDelete(taskId);

    // Remove from project's tasks array
    await Project.findByIdAndUpdate(task.projectId, {
      $pull: { tasks: task._id },
    });

    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getTasks,
  updateTask,
  updateTaskStatus,
  retryTask,
  deleteTask,
};
