const Task = require("../models/Task");
const Project = require("../models/Project");
const auditLog = require("../utils/auditLogger");
const { hasCycle } = require("../utils/cycleDetection");
const { triggerWebhook } = require("../utils/webhookTrigger");

// Helper: verify user is a project member
const assertMember = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project)
    throw Object.assign(new Error("Project not found"), { status: 404 });
  const uid = userId.toString();
  const ok =
    project.owner.toString() === uid ||
    project.members.some((m) => m.user.toString() === uid);
  if (!ok) throw Object.assign(new Error("Access denied"), { status: 403 });
  return project;
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

    if (!title || !description)
      return res
        .status(400)
        .json({
          success: false,
          message: "Title and description are required",
        });

    await assertMember(projectId, req.user._id);

    // Cycle detection
    if (dependencies && dependencies.length > 0) {
      const projectTasks = await Task.find({ projectId }, "_id dependencies");
      const fakePending = {
        _id: { toString: () => "new_pending" },
        dependencies: dependencies,
      };
      if (hasCycle("new_pending", dependencies, [...projectTasks, fakePending]))
        return res
          .status(400)
          .json({ success: false, message: "Cyclic dependency detected" });
    }

    const task = await Task.create({
      title,
      description,
      priority: priority || 3,
      estimatedHours: estimatedHours || 1,
      resourceTag: resourceTag || "",
      maxRetries: maxRetries !== undefined ? maxRetries : 3,
      dependencies: dependencies || [],
      projectId,
      user: req.user._id,
    });

    await Project.findByIdAndUpdate(projectId, { $push: { tasks: task._id } });
    await auditLog(req.user._id, "task.created", "Task", task._id, {
      title,
      projectId,
    });

    // Emit via socket if available
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("task:created", task);

    res
      .status(201)
      .json({ success: true, message: "Task created", data: task });
  } catch (error) {
    next(error);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    await assertMember(projectId, req.user._id);
    const tasks = await Task.find({ projectId }).populate(
      "dependencies",
      "title status priority",
    );
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId).populate(
      "dependencies",
      "title status",
    );
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

const getTaskHistory = async (req, res, next) => {
  try {
    const task = await Task.findById(
      req.params.taskId,
      "versionHistory title",
    ).populate("versionHistory.updatedBy", "name");
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    res
      .status(200)
      .json({
        success: true,
        data: task.versionHistory.sort(
          (a, b) => b.versionNumber - a.versionNumber,
        ),
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
      versionNumber,
    } = req.body;

    const task = await Task.findById(taskId);
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    await assertMember(task.projectId, req.user._id);

    // Optimistic concurrency check
    if (
      versionNumber !== undefined &&
      task.versionNumber !== Number(versionNumber)
    )
      return res.status(409).json({
        success: false,
        message:
          "Update conflict: task was modified by someone else. Refresh and try again.",
        latestData: task,
      });

    // Cycle detection on dependency change
    if (dependencies !== undefined) {
      const projectTasks = await Task.find(
        { projectId: task.projectId },
        "_id dependencies",
      );
      const others = projectTasks.filter(
        (t) => t._id.toString() !== task._id.toString(),
      );
      if (
        hasCycle(task._id, dependencies, [
          ...others,
          { _id: task._id, dependencies },
        ])
      )
        return res
          .status(400)
          .json({ success: false, message: "Cyclic dependency detected" });
    }

    // Save version snapshot before update
    task.versionHistory.push({
      versionNumber: task.versionNumber,
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      status: task.status,
      dependencies: task.dependencies,
      resourceTag: task.resourceTag,
      maxRetries: task.maxRetries,
      retryCount: task.retryCount,
      updatedBy: req.user._id,
    });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
    if (resourceTag !== undefined) task.resourceTag = resourceTag;
    if (maxRetries !== undefined) task.maxRetries = maxRetries;
    if (dependencies !== undefined) task.dependencies = dependencies;
    task.versionNumber += 1;

    await task.save();
    await auditLog(req.user._id, "task.updated", "Task", task._id, {
      fields: Object.keys(req.body),
    });

    const io = req.app.get("io");
    if (io) io.to(task.projectId.toString()).emit("task:updated", task);

    res
      .status(200)
      .json({ success: true, message: "Task updated", data: task });
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
    if (!validStatuses.includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });

    const task = await Task.findById(taskId).populate("dependencies", "status");
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    await assertMember(task.projectId, req.user._id);

    if (status === "Running") {
      const depsDone = task.dependencies.every((d) => d.status === "Completed");
      if (!depsDone)
        return res
          .status(400)
          .json({
            success: false,
            message: "Cannot run: not all dependencies are Completed",
          });

      if (task.resourceTag) {
        const conflict = await Task.findOne({
          projectId: task.projectId,
          resourceTag: task.resourceTag,
          status: "Running",
          _id: { $ne: task._id },
        });
        if (conflict)
          return res
            .status(400)
            .json({
              success: false,
              message: `Resource conflict: "${conflict.title}" already Running with tag "${task.resourceTag}"`,
            });
      }
    }

    if (status === "Failed")
      await auditLog(req.user._id, "task.failed", "Task", task._id, {
        previousStatus: task.status,
      });

    task.versionHistory.push({
      versionNumber: task.versionNumber,
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      status: task.status,
      dependencies: task.dependencies.map((d) => d._id),
      resourceTag: task.resourceTag,
      maxRetries: task.maxRetries,
      retryCount: task.retryCount,
      updatedBy: req.user._id,
    });

    task.status = status;
    task.versionNumber += 1;
    await task.save();

    await auditLog(req.user._id, "task.status_changed", "Task", task._id, {
      status,
    });

    // Fire webhook on completion
    if (status === "Completed") triggerWebhook(task.projectId, task);

    const io = req.app.get("io");
    if (io)
      io.to(task.projectId.toString()).emit("task:statusChanged", {
        taskId: task._id,
        status,
        task,
      });

    res
      .status(200)
      .json({ success: true, message: "Status updated", data: task });
  } catch (error) {
    next(error);
  }
};

const retryTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const task = await Task.findById(taskId);
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    await assertMember(task.projectId, req.user._id);

    if (task.status !== "Failed")
      return res
        .status(400)
        .json({ success: false, message: "Only Failed tasks can be retried" });
    if (task.retryCount >= task.maxRetries)
      return res
        .status(400)
        .json({
          success: false,
          message: `Max retries (${task.maxRetries}) reached`,
        });

    task.retryCount += 1;
    task.status = "Pending";
    task.versionNumber += 1;
    await task.save();

    await auditLog(req.user._id, "task.retried", "Task", task._id, {
      retryCount: task.retryCount,
    });

    const io = req.app.get("io");
    if (io)
      io.to(task.projectId.toString()).emit("task:retried", {
        taskId: task._id,
        retryCount: task.retryCount,
      });

    res
      .status(200)
      .json({
        success: true,
        message: `Retry ${task.retryCount}/${task.maxRetries}`,
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
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    await assertMember(task.projectId, req.user._id);

    await Task.findByIdAndDelete(taskId);
    await Project.findByIdAndUpdate(task.projectId, {
      $pull: { tasks: task._id },
    });
    await auditLog(req.user._id, "task.deleted", "Task", task._id, {
      title: task.title,
    });

    const io = req.app.get("io");
    if (io)
      io.to(task.projectId.toString()).emit("task:deleted", {
        taskId: task._id,
      });

    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    next(error);
  }
};

// POST /api/project/:id/compute-execution
const computeExecution = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    await assertMember(projectId, req.user._id);

    const allTasks = await Task.find({ projectId });
    const taskMap = {};
    allTasks.forEach((t) => (taskMap[t._id.toString()] = t));

    // Exclude Blocked tasks
    const eligible = allTasks.filter((t) => t.status !== "Blocked");

    // Topological sort (Kahn's algorithm)
    const inDegree = {};
    const adj = {};
    eligible.forEach((t) => {
      inDegree[t._id.toString()] = 0;
      adj[t._id.toString()] = [];
    });

    eligible.forEach((t) => {
      (t.dependencies || []).forEach((depId) => {
        const dep = depId.toString();
        if (inDegree[dep] !== undefined) {
          inDegree[t._id.toString()]++;
          adj[dep].push(t._id.toString());
        }
      });
    });

    // Sort candidates by priority desc, estimatedHours asc, createdAt asc
    const compareTasks = (a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.estimatedHours !== b.estimatedHours)
        return a.estimatedHours - b.estimatedHours;
      return new Date(a.createdAt) - new Date(b.createdAt);
    };

    let queue = eligible
      .filter((t) => inDegree[t._id.toString()] === 0)
      .sort(compareTasks);
    const executionOrder = [];

    while (queue.length) {
      const task = queue.shift();
      executionOrder.push(task);
      const neighbors = (adj[task._id.toString()] || [])
        .map((id) => taskMap[id])
        .filter(Boolean);
      for (const neighbor of neighbors) {
        inDegree[neighbor._id.toString()]--;
        if (inDegree[neighbor._id.toString()] === 0) queue.push(neighbor);
      }
      queue.sort(compareTasks);
    }

    const blockedTasks = allTasks.filter((t) => t.status === "Blocked");

    res.status(200).json({
      success: true,
      data: {
        executionOrder: executionOrder.map((t, i) => ({
          step: i + 1,
          _id: t._id,
          title: t.title,
          priority: t.priority,
          estimatedHours: t.estimatedHours,
          status: t.status,
        })),
        blockedTasks: blockedTasks.map((t) => ({
          _id: t._id,
          title: t.title,
          status: t.status,
        })),
        totalTasks: allTasks.length,
        eligibleCount: eligible.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/project/:id/simulate
const simulate = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { availableHours, failedTaskIds = [] } = req.body;

    if (!availableHours || availableHours <= 0)
      return res
        .status(400)
        .json({
          success: false,
          message: "availableHours required and must be > 0",
        });

    await assertMember(projectId, req.user._id);
    const allTasks = await Task.find({ projectId });
    const taskMap = {};
    allTasks.forEach((t) => (taskMap[t._id.toString()] = t));

    const failedSet = new Set(failedTaskIds.map((id) => id.toString()));

    // Tasks blocked due to Failed dependency
    const isBlockedByFailed = (task, visited = new Set()) => {
      if (visited.has(task._id.toString())) return false;
      visited.add(task._id.toString());
      for (const depId of task.dependencies || []) {
        const dep = taskMap[depId.toString()];
        if (!dep) continue;
        if (failedSet.has(dep._id.toString()) || dep.status === "Failed")
          return true;
        if (isBlockedByFailed(dep, visited)) return true;
      }
      return false;
    };

    const blockedTasks = [];
    const candidateTasks = [];

    for (const task of allTasks) {
      if (task.status === "Blocked" || task.status === "Completed") continue;
      if (failedSet.has(task._id.toString()) || task.status === "Failed") {
        blockedTasks.push(task);
        continue;
      }
      if (isBlockedByFailed(task)) {
        blockedTasks.push(task);
        continue;
      }
      candidateTasks.push(task);
    }

    // Topological sort on candidates
    const inDegree = {};
    const adj = {};
    candidateTasks.forEach((t) => {
      inDegree[t._id.toString()] = 0;
      adj[t._id.toString()] = [];
    });
    candidateTasks.forEach((t) => {
      (t.dependencies || []).forEach((depId) => {
        const dep = depId.toString();
        if (inDegree[dep] !== undefined) {
          inDegree[t._id.toString()]++;
          adj[dep].push(t._id.toString());
        }
      });
    });

    const compareFn = (a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.estimatedHours !== b.estimatedHours)
        return a.estimatedHours - b.estimatedHours;
      return new Date(a.createdAt) - new Date(b.createdAt);
    };

    let queue = candidateTasks
      .filter((t) => inDegree[t._id.toString()] === 0)
      .sort(compareFn);
    const executionOrder = [];
    const selectedTasks = [];
    const skippedTasks = [];
    let hoursUsed = 0;
    let totalPriorityScore = 0;

    while (queue.length) {
      const task = queue.shift();
      if (hoursUsed + task.estimatedHours <= availableHours) {
        executionOrder.push(task);
        selectedTasks.push(task);
        hoursUsed += task.estimatedHours;
        totalPriorityScore += task.priority;
        const neighbors = (adj[task._id.toString()] || [])
          .map((id) => taskMap[id])
          .filter(Boolean);
        for (const n of neighbors) {
          inDegree[n._id.toString()]--;
          if (inDegree[n._id.toString()] === 0) queue.push(n);
        }
        queue.sort(compareFn);
      } else {
        skippedTasks.push(task);
      }
    }

    const fmt = (t) => ({
      _id: t._id,
      title: t.title,
      priority: t.priority,
      estimatedHours: t.estimatedHours,
      status: t.status,
    });

    res.status(200).json({
      success: true,
      data: {
        availableHours,
        hoursUsed: Math.round(hoursUsed * 100) / 100,
        executionOrder: executionOrder.map((t, i) => ({
          step: i + 1,
          ...fmt(t),
        })),
        selectedTasks: selectedTasks.map(fmt),
        blockedTasks: blockedTasks.map(fmt),
        skippedTasks: skippedTasks.map(fmt),
        totalPriorityScore,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
