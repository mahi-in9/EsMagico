import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { io } from "socket.io-client";
import {
  getProjectById,
  generateInvite,
  clearInviteToken,
  computeExecution,
  runSimulation,
  clearExecutionPlan,
  clearSimulation,
  updateWebhook,
} from "../app/slice/projectSlice";
import {
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  retryTask,
  deleteTask,
  clearConflictError,
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskStatusChanged,
  socketTaskDeleted,
} from "../app/slice/taskSlice";

const STATUS_COLOR = {
  Pending: "bg-gray-100 text-gray-700",
  Running: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
  Blocked: "bg-yellow-100 text-yellow-700",
};
const STATUSES = ["Pending", "Running", "Completed", "Failed", "Blocked"];

const defaultForm = {
  title: "",
  description: "",
  priority: 3,
  estimatedHours: 1,
  resourceTag: "",
  maxRetries: 3,
  dependencies: [],
};

const ProjectDetails = () => {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const {
    currentProject,
    inviteToken,
    executionPlan,
    simulationResult,
    actionLoading,
  } = useSelector((s) => s.project);
  const {
    tasks,
    loading: taskLoading,
    error: taskError,
    conflictError,
  } = useSelector((s) => s.task);
  const { user } = useSelector((s) => s.auth);

  const [tab, setTab] = useState("tasks");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState("");
  const [simForm, setSimForm] = useState({
    availableHours: 8,
    failedTaskIds: "",
  });
  const [webhookInput, setWebhookInput] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  // Load project and tasks
  useEffect(() => {
    dispatch(getProjectById(projectId));
    dispatch(getTasks(projectId));
  }, [dispatch, projectId]);

  useEffect(() => {
    if (currentProject?.webhookUrl) setWebhookInput(currentProject.webhookUrl);
  }, [currentProject]);

  // Socket.io connection
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL, {
      auth: { token: localStorage.getItem("token") },
    });
    socketRef.current = socket;
    socket.emit("join:project", projectId);
    socket.on("task:created", (task) => dispatch(socketTaskCreated(task)));
    socket.on("task:updated", (task) => dispatch(socketTaskUpdated(task)));
    socket.on("task:statusChanged", (data) =>
      dispatch(socketTaskStatusChanged(data)),
    );
    socket.on("task:retried", (data) =>
      dispatch(
        socketTaskStatusChanged({ taskId: data.taskId, status: "Pending" }),
      ),
    );
    socket.on("task:deleted", (data) => dispatch(socketTaskDeleted(data)));
    return () => {
      socket.emit("leave:project", projectId);
      socket.disconnect();
    };
  }, [projectId, dispatch]);

  const isOwner = currentProject?.owner?._id === user?._id;

  const handleFormChange = (e) => {
    const { name, value, options } = e.target;
    if (name === "dependencies") {
      const selected = Array.from(options)
        .filter((o) => o.selected)
        .map((o) => o.value);
      setForm((p) => ({ ...p, dependencies: selected }));
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm(defaultForm);
    setFormError("");
    setShowTaskForm(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      resourceTag: task.resourceTag,
      maxRetries: task.maxRetries,
      dependencies: task.dependencies?.map((d) => d._id || d) || [],
      versionNumber: task.versionNumber,
    });
    setFormError("");
    setShowTaskForm(true);
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim())
      return setFormError("Title and description required");
    const payload = {
      ...form,
      priority: Number(form.priority),
      estimatedHours: Number(form.estimatedHours),
      maxRetries: Number(form.maxRetries),
    };

    if (editingTask) {
      payload.versionNumber = editingTask.versionNumber;
      const result = await dispatch(
        updateTask({ projectId, taskId: editingTask._id, taskData: payload }),
      );
      if (updateTask.rejected.match(result))
        return setFormError(result.payload?.message || "Update failed");
    } else {
      const result = await dispatch(
        createTask({ projectId, taskData: payload }),
      );
      if (createTask.rejected.match(result))
        return setFormError(result.payload?.message || "Create failed");
    }
    setShowTaskForm(false);
    setEditingTask(null);
    setForm(defaultForm);
  };

  const handleStatusChange = (task, status) => {
    dispatch(updateTaskStatus({ projectId, taskId: task._id, status }));
  };

  const handleRetry = (task) =>
    dispatch(retryTask({ projectId, taskId: task._id }));
  const handleDelete = (task) => {
    if (window.confirm(`Delete "${task.title}"?`))
      dispatch(deleteTask({ projectId, taskId: task._id }));
  };

  const handleGenerateInvite = async () => {
    await dispatch(generateInvite(projectId));
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteToken);
    setCopyMsg("Copied!");
    setTimeout(() => setCopyMsg(""), 2000);
  };

  const handleComputeExecution = () => dispatch(computeExecution(projectId));

  const handleSimulate = (e) => {
    e.preventDefault();
    const failedIds = simForm.failedTaskIds.trim()
      ? simForm.failedTaskIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    dispatch(
      runSimulation({
        id: projectId,
        body: {
          availableHours: Number(simForm.availableHours),
          failedTaskIds: failedIds,
        },
      }),
    );
  };

  const handleWebhookSave = (e) => {
    e.preventDefault();
    dispatch(updateWebhook({ id: projectId, webhookUrl: webhookInput }));
  };
  const api = import.meta.env.VITE_API_URL;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/project" className="hover:underline">
              Projects
            </Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">
              {currentProject?.title || "Loading..."}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {currentProject?.title}
              </h1>
              <p className="text-gray-500 text-sm">
                {currentProject?.description}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/project/${projectId}/audit`}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                📋 Audit Logs
              </Link>
              {isOwner && (
                <button
                  onClick={handleGenerateInvite}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition"
                >
                  🔗 Generate Invite
                </button>
              )}
            </div>
          </div>

          {/* Invite token display */}
          {inviteToken && (
            <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-purple-600 font-medium mb-1">
                  Invite Token (valid 30 min)
                </p>
                <p className="text-xs text-gray-700 font-mono break-all">
                  {`${api}/join/:${inviteToken}`}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleCopyInvite}
                  className="px-3 py-1 bg-purple-600 text-white rounded text-xs whitespace-nowrap"
                >
                  {copyMsg || "Copy"}
                </button>
                <button
                  onClick={() => dispatch(clearInviteToken())}
                  className="text-xs text-gray-400 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 mt-4 border-b">
            {["tasks", "execution", "simulation", "members", "settings"].map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition capitalize ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  {t}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* CONFLICT BANNER */}
        {conflictError && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded-lg flex justify-between items-center">
            <p className="text-yellow-800 text-sm">
              ⚠️ {conflictError.message}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  dispatch(getTasks(projectId));
                  dispatch(clearConflictError());
                }}
                className="px-3 py-1 bg-yellow-500 text-white rounded text-sm"
              >
                Refresh
              </button>
              <button
                onClick={() => dispatch(clearConflictError())}
                className="text-yellow-600 text-sm underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* TASKS TAB */}
        {tab === "tasks" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {tasks.length} Task{tasks.length !== 1 ? "s" : ""}
              </h2>
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition"
              >
                ➕ New Task
              </button>
            </div>

            {taskError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
                {taskError?.message || "Error loading tasks"}
              </div>
            )}

            {/* Task Form */}
            {showTaskForm && (
              <div className="bg-white p-6 rounded-xl shadow mb-6">
                <h3 className="font-semibold mb-4">
                  {editingTask ? "Edit Task" : "Create Task"}
                </h3>
                <form
                  onSubmit={handleTaskSubmit}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-600">Title *</label>
                    <input
                      name="title"
                      value={form.title}
                      onChange={handleFormChange}
                      className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-600">
                      Description *
                    </label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleFormChange}
                      rows={2}
                      className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">
                      Priority (1–5)
                    </label>
                    <input
                      type="number"
                      name="priority"
                      min={1}
                      max={5}
                      value={form.priority}
                      onChange={handleFormChange}
                      className="w-full mt-1 px-3 py-2 border rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">
                      Estimated Hours
                    </label>
                    <input
                      type="number"
                      name="estimatedHours"
                      min={0.1}
                      step={0.5}
                      value={form.estimatedHours}
                      onChange={handleFormChange}
                      className="w-full mt-1 px-3 py-2 border rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">
                      Resource Tag
                    </label>
                    <input
                      name="resourceTag"
                      value={form.resourceTag}
                      onChange={handleFormChange}
                      placeholder="e.g. GPU, DB"
                      className="w-full mt-1 px-3 py-2 border rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Max Retries</label>
                    <input
                      type="number"
                      name="maxRetries"
                      min={0}
                      value={form.maxRetries}
                      onChange={handleFormChange}
                      className="w-full mt-1 px-3 py-2 border rounded-lg outline-none"
                    />
                  </div>
                  {tasks.filter(
                    (t) => !editingTask || t._id !== editingTask._id,
                  ).length > 0 && (
                    <div className="md:col-span-2">
                      <label className="text-sm text-gray-600">
                        Dependencies (Ctrl+click to multi-select)
                      </label>
                      <select
                        multiple
                        name="dependencies"
                        value={form.dependencies}
                        onChange={handleFormChange}
                        className="w-full mt-1 px-3 py-2 border rounded-lg outline-none h-28"
                      >
                        {tasks
                          .filter(
                            (t) => !editingTask || t._id !== editingTask._id,
                          )
                          .map((t) => (
                            <option key={t._id} value={t._id}>
                              {t.title} (P{t.priority} · {t.status})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  {formError && (
                    <p className="md:col-span-2 text-red-500 text-sm">
                      {formError}
                    </p>
                  )}
                  <div className="md:col-span-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={taskLoading}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      {taskLoading
                        ? "Saving..."
                        : editingTask
                          ? "Update Task"
                          : "Create Task"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTaskForm(false)}
                      className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {taskLoading && (
              <p className="text-center text-gray-500 py-8">Loading tasks...</p>
            )}

            {!taskLoading && tasks.length === 0 && (
              <div className="text-center py-16 text-gray-500">
                <p className="text-4xl mb-3">📝</p>
                <p>No tasks yet. Create the first task.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <div
                  key={task._id}
                  className="bg-white rounded-xl shadow p-4 flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-gray-800 flex-1 pr-2">
                      {task.title}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLOR[task.status]}`}
                    >
                      {task.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {task.description}
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                    <span>
                      🎯 Priority: <b>{task.priority}</b>
                    </span>
                    <span>⏱ {task.estimatedHours}h</span>
                    <span>
                      🔄 Retries: {task.retryCount}/{task.maxRetries}
                    </span>
                    <span>📌 v{task.versionNumber}</span>
                    {task.resourceTag && (
                      <span className="col-span-2">🏷 {task.resourceTag}</span>
                    )}
                  </div>
                  {task.dependencies?.length > 0 && (
                    <div className="text-xs text-gray-500">
                      <span className="font-medium">Depends on: </span>
                      {task.dependencies.map((d) => (
                        <span
                          key={d._id || d}
                          className="bg-gray-100 px-1.5 py-0.5 rounded mr-1"
                        >
                          {d.title || d}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value)}
                      className="flex-1 text-xs border rounded-lg px-2 py-1 outline-none"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => openEdit(task)}
                      className="text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(task)}
                      className="text-xs px-2 py-1 border border-red-200 text-red-500 rounded-lg hover:bg-red-50"
                    >
                      🗑
                    </button>
                  </div>
                  {task.status === "Failed" &&
                    task.retryCount < task.maxRetries && (
                      <button
                        onClick={() => handleRetry(task)}
                        className="w-full text-xs bg-orange-500 text-white py-1.5 rounded-lg hover:bg-orange-600 transition"
                      >
                        ↩ Retry ({task.maxRetries - task.retryCount} left)
                      </button>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXECUTION TAB */}
        {tab === "execution" && (
          <div className="max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold">Execution Plan</h2>
                <p className="text-sm text-gray-500">
                  Computes a dependency-aware, priority-sorted execution order
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleComputeExecution}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm transition"
                >
                  {actionLoading ? "Computing..." : "▶ Compute Plan"}
                </button>
                {executionPlan && (
                  <button
                    onClick={() => dispatch(clearExecutionPlan())}
                    className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {executionPlan && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-xl shadow">
                  <h3 className="font-medium mb-3">
                    Execution Order ({executionPlan.executionOrder?.length}{" "}
                    tasks)
                  </h3>
                  {executionPlan.executionOrder?.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      No tasks eligible for execution
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {executionPlan.executionOrder?.map((task) => (
                        <div
                          key={task._id}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                          <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                            {task.step}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-gray-500">
                              Priority {task.priority} · {task.estimatedHours}h
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[task.status]}`}
                          >
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {executionPlan.blockedTasks?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                    <h3 className="font-medium text-yellow-800 mb-2">
                      🚫 Blocked Tasks ({executionPlan.blockedTasks.length})
                    </h3>
                    <div className="space-y-1">
                      {executionPlan.blockedTasks.map((t) => (
                        <div
                          key={t._id}
                          className="flex justify-between text-sm"
                        >
                          <span>{t.title}</span>
                          <span className="text-yellow-600">{t.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SIMULATION TAB */}
        {tab === "simulation" && (
          <div className="max-w-3xl">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Daily Simulation</h2>
              <p className="text-sm text-gray-500">
                Simulate which tasks fit within a given time window
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl shadow mb-6">
              <form onSubmit={handleSimulate} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Available Hours
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={simForm.availableHours}
                    onChange={(e) =>
                      setSimForm((p) => ({
                        ...p,
                        availableHours: e.target.value,
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Failed Task IDs (comma-separated, optional)
                  </label>
                  <input
                    type="text"
                    value={simForm.failedTaskIds}
                    placeholder="taskId1, taskId2, ..."
                    onChange={(e) =>
                      setSimForm((p) => ({
                        ...p,
                        failedTaskIds: e.target.value,
                      }))
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {actionLoading ? "Running..." : "▶ Run Simulation"}
                  </button>
                  {simulationResult && (
                    <button
                      type="button"
                      onClick={() => dispatch(clearSimulation())}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>

            {simulationResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Hours Available",
                      value: simulationResult.availableHours,
                    },
                    { label: "Hours Used", value: simulationResult.hoursUsed },
                    {
                      label: "Tasks Selected",
                      value: simulationResult.selectedTasks?.length,
                    },
                    {
                      label: "Priority Score",
                      value: simulationResult.totalPriorityScore,
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="bg-white p-3 rounded-xl shadow text-center"
                    >
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="text-xl font-bold mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Execution Order */}
                <div className="bg-white p-4 rounded-xl shadow">
                  <h3 className="font-medium mb-3">
                    ✅ Selected ({simulationResult.selectedTasks?.length})
                  </h3>
                  <div className="space-y-2">
                    {simulationResult.executionOrder?.map((t) => (
                      <div
                        key={t._id}
                        className="flex items-center gap-3 p-2 bg-green-50 rounded-lg"
                      >
                        <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {t.step}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{t.title}</p>
                          <p className="text-xs text-gray-500">
                            P{t.priority} · {t.estimatedHours}h
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {simulationResult.skippedTasks?.length > 0 && (
                  <div className="bg-white p-4 rounded-xl shadow">
                    <h3 className="font-medium mb-3 text-gray-600">
                      ⏭ Skipped (no time) (
                      {simulationResult.skippedTasks.length})
                    </h3>
                    <div className="space-y-1">
                      {simulationResult.skippedTasks.map((t) => (
                        <div
                          key={t._id}
                          className="flex justify-between text-sm p-2 bg-gray-50 rounded"
                        >
                          <span>{t.title}</span>
                          <span className="text-gray-500">
                            {t.estimatedHours}h
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {simulationResult.blockedTasks?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                    <h3 className="font-medium text-yellow-800 mb-2">
                      🚫 Blocked ({simulationResult.blockedTasks.length})
                    </h3>
                    <div className="space-y-1">
                      {simulationResult.blockedTasks.map((t) => (
                        <div
                          key={t._id}
                          className="flex justify-between text-sm"
                        >
                          <span>{t.title}</span>
                          <span className="text-yellow-600">{t.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MEMBERS TAB */}
        {tab === "members" && (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">Members</h2>
            <div className="bg-white rounded-xl shadow divide-y">
              {/* Owner */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{currentProject?.owner?.name}</p>
                  <p className="text-xs text-gray-500">
                    {currentProject?.owner?.email}
                  </p>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  Owner
                </span>
              </div>
              {currentProject?.members?.map((m) => (
                <div
                  key={m.user?._id}
                  className="p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{m.user?.name}</p>
                    <p className="text-xs text-gray-500">{m.user?.email}</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && isOwner && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-white p-5 rounded-xl shadow">
              <h3 className="font-semibold mb-3">Webhook Configuration</h3>
              <p className="text-sm text-gray-500 mb-3">
                Triggered when a task is Completed. Retried up to 3 times.
              </p>
              <form onSubmit={handleWebhookSave} className="flex gap-3">
                <input
                  type="url"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  placeholder="https://your-webhook.com/endpoint"
                  className="flex-1 px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition"
                >
                  Save
                </button>
              </form>
            </div>
          </div>
        )}
        {tab === "settings" && !isOwner && (
          <div className="text-center py-12 text-gray-500">
            Only the project owner can manage settings.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;
