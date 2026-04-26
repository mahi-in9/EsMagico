const Task = require("../models/Task");
const Project = require("../models/Project");
const auditLog = require("../utils/auditLogger");
const { hasCycle } = require("../utils/cycleDetection");
const { triggerWebhook } = require("../utils/webhookTrigger");
const ExecutionService = require("../services/ExecutionService");

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

    if (dependencies && dependencies.length > 0) {
      const projectTasks = await Task.find({ projectId }, "_id dependencies");
      // Temporarily add new task with these deps for cycle check
      const fakeId = "new__" + Date.now();
      const allForCheck = [
        ...projectTasks.map((t) => ({
          _id: t._id,
          dependencies: t.dependencies,
        })),
        { _id: { toString: () => fakeId }, dependencies },
      ];
      if (hasCycle(fakeId, dependencies, allForCheck))
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Cyclic dependency detected. This would create a dependency loop.",
          });
    }

    const task = await Task.create({
      title,
      description,
      priority: Number(priority) || 3,
      estimatedHours: Number(estimatedHours) || 1,
      resourceTag: resourceTag || "",
      maxRetries: maxRetries !== undefined ? Number(maxRetries) : 3,
      dependencies: dependencies || [],
      projectId,
      user: req.user._id,
    });

    await Project.findByIdAndUpdate(projectId, { $push: { tasks: task._id } });
    await auditLog(req.user._id, "task.created", "Task", task._id, {
      title,
      projectId,
    });

    const populated = await Task.findById(task._id).populate(
      "dependencies",
      "title status priority",
    );
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("task:created", populated);

    res
      .status(201)
      .json({ success: true, message: "Task created", data: populated });
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
      "title status priority",
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
        data: [...task.versionHistory].sort(
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

    if (
      versionNumber !== undefined &&
      task.versionNumber !== Number(versionNumber)
    )
      return res.status(409).json({
        success: false,
        message:
          "Update conflict: this task was modified by someone else. Refresh and try again.",
        latestData: task,
      });

    if (dependencies !== undefined && dependencies.length > 0) {
      const projectTasks = await Task.find(
        { projectId: task.projectId },
        "_id dependencies",
      );
      const others = projectTasks.filter(
        (t) => t._id.toString() !== task._id.toString(),
      );
      if (
        hasCycle(task._id.toString(), dependencies, [
          ...others,
          { _id: task._id, dependencies },
        ])
      )
        return res
          .status(400)
          .json({ success: false, message: "Cyclic dependency detected." });
    }

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
    if (priority !== undefined) task.priority = Number(priority);
    if (estimatedHours !== undefined)
      task.estimatedHours = Number(estimatedHours);
    if (resourceTag !== undefined) task.resourceTag = resourceTag;
    if (maxRetries !== undefined) task.maxRetries = Number(maxRetries);
    if (dependencies !== undefined) task.dependencies = dependencies;
    task.versionNumber += 1;
    await task.save();

    await auditLog(req.user._id, "task.updated", "Task", task._id, {
      fields: Object.keys(req.body),
    });
    const populated = await Task.findById(task._id).populate(
      "dependencies",
      "title status priority",
    );
    const io = req.app.get("io");
    if (io) io.to(task.projectId.toString()).emit("task:updated", populated);

    res
      .status(200)
      .json({ success: true, message: "Task updated", data: populated });
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

    const task = await Task.findById(taskId).populate(
      "dependencies",
      "status title",
    );
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    await assertMember(task.projectId, req.user._id);

    if (status === "Running") {
      const unfinished = task.dependencies.filter(
        (d) => d.status !== "Completed",
      );
      if (unfinished.length > 0)
        return res.status(400).json({
          success: false,
          message: `Cannot run: dependency "${unfinished[0].title}" is not Completed (currently ${unfinished[0].status})`,
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
              message: `Resource conflict: "${conflict.title}" is already Running with tag "${task.resourceTag}"`,
            });
      }
    }

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

    if (status === "Failed")
      await auditLog(req.user._id, "task.failed", "Task", task._id, {
        previousStatus: task.status,
      });
    await auditLog(req.user._id, "task.status_changed", "Task", task._id, {
      status,
    });
    if (status === "Completed") triggerWebhook(task.projectId, task);

    const populated = await Task.findById(task._id).populate(
      "dependencies",
      "title status priority",
    );
    const io = req.app.get("io");
    if (io)
      io.to(task.projectId.toString()).emit("task:statusChanged", {
        taskId: task._id,
        status,
        task: populated,
      });

    res
      .status(200)
      .json({ success: true, message: "Status updated", data: populated });
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
        task,
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

// POST /api/project/:id/compute-execution  — uses ExecutionService
const computeExecution = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    await assertMember(projectId, req.user._id);
    const allTasks = await Task.find({ projectId });
    const eligible = allTasks.filter((t) => t.status !== "Blocked");
    const plan = ExecutionService.computeExecutionPlan(eligible);
    const blocked = allTasks.filter((t) => t.status === "Blocked");

    res.status(200).json({
      success: true,
      data: {
        steps: plan.map((step) => ({
          step: step.step,
          parallel: step.parallel,
          tasks: step.tasks.map((t) => ({
            _id: t._id,
            title: t.title,
            priority: t.priority,
            estimatedHours: t.estimatedHours,
            status: t.status,
            resourceTag: t.resourceTag,
          })),
        })),
        blockedTasks: blocked.map((t) => ({
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

// POST /api/project/:id/simulate  — uses ExecutionService
const simulate = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const { availableHours, failedTaskIds = [] } = req.body;
    if (!availableHours || availableHours <= 0)
      return res
        .status(400)
        .json({ success: false, message: "availableHours must be > 0" });

    await assertMember(projectId, req.user._id);
    const allTasks = await Task.find({ projectId });
    const result = ExecutionService.simulate(
      allTasks,
      Number(availableHours),
      failedTaskIds,
    );

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
        availableHours: Number(availableHours),
        hoursUsed: Math.round(result.hoursUsed * 100) / 100,
        log: result.log,
        steps: result.plan.map((step) => ({
          step: step.step,
          parallel: step.parallel,
          tasks: step.tasks.map(fmt),
        })),
        selectedTasks: result.selected.map(fmt),
        blockedTasks: result.blocked.map(fmt),
        skippedTasks: result.skipped.map(fmt),
        totalPriorityScore: result.totalPriorityScore,
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
