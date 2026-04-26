import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import {
  createTask,
  getTasks,
  updateTaskStatus,
  retryTask,
  deleteTask,
} from "../app/slice/taskSlice";
import { clearConflictError } from "../app/slice/taskSlice";

const STATUS_OPTIONS = ["Pending", "Running", "Completed", "Failed", "Blocked"];

const statusColor = {
  Pending: "bg-gray-100 text-gray-700",
  Running: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Failed: "bg-red-100 text-red-700",
  Blocked: "bg-yellow-100 text-yellow-700",
};

function Task() {
  const dispatch = useDispatch();
  const { projectId } = useParams();

  const { tasks, loading, error, conflictError } = useSelector(
    (state) => state.task,
  );

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: 3,
    estimatedHours: 1,
    resourceTag: "",
    maxRetries: 3,
    dependencies: [],
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (projectId) dispatch(getTasks(projectId));
  }, [dispatch, projectId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDepsChange = (e) => {
    // Multi-select: collect all selected option values
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    setFormData((prev) => ({ ...prev, dependencies: selected }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return;

    const result = await dispatch(
      createTask({
        projectId,
        taskData: {
          ...formData,
          priority: Number(formData.priority),
          estimatedHours: Number(formData.estimatedHours),
          maxRetries: Number(formData.maxRetries),
        },
      }),
    );

    if (createTask.fulfilled.match(result)) {
      setFormData({
        title: "",
        description: "",
        priority: 3,
        estimatedHours: 1,
        resourceTag: "",
        maxRetries: 3,
        dependencies: [],
      });
      setShowForm(false);
    }
  };

  const handleStatusChange = (taskId, status) => {
    dispatch(updateTaskStatus({ projectId, taskId, status }));
  };

  const handleRetry = (taskId) => {
    dispatch(retryTask({ projectId, taskId }));
  };

  const handleDelete = (taskId) => {
    if (window.confirm("Delete this task?")) {
      dispatch(deleteTask({ projectId, taskId }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Version conflict banner */}
        {conflictError && (
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-4 rounded-md mb-4 flex justify-between items-center">
            <span>
              {conflictError.message} Refresh to see the latest version.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => dispatch(getTasks(projectId))}
                className="bg-yellow-600 text-white px-3 py-1 rounded-md text-sm"
              >
                Refresh
              </button>
              <button
                onClick={() => dispatch(clearConflictError())}
                className="text-yellow-600 underline text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <button
            onClick={() => setShowForm((p) => !p)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "New Task"}
          </button>
        </div>

        {/* Create Task Form */}
        {showForm && (
          <div className="bg-white p-5 rounded-lg shadow mb-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                name="title"
                placeholder="Task Title"
                value={formData.title}
                onChange={handleChange}
                className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                name="description"
                placeholder="Task Description"
                value={formData.description}
                onChange={handleChange}
                className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">
                    Priority (1–5)
                  </label>
                  <input
                    type="number"
                    name="priority"
                    min={1}
                    max={5}
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">
                    Estimated Hours
                  </label>
                  <input
                    type="number"
                    name="estimatedHours"
                    min={0.5}
                    step={0.5}
                    value={formData.estimatedHours}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">
                    Resource Tag
                  </label>
                  <input
                    type="text"
                    name="resourceTag"
                    placeholder="e.g. GPU, DB, API"
                    value={formData.resourceTag}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 block mb-1">
                    Max Retries
                  </label>
                  <input
                    type="number"
                    name="maxRetries"
                    min={0}
                    max={10}
                    value={formData.maxRetries}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-md"
                  />
                </div>
              </div>

              {/* Dependency multi-select — only show if there are existing tasks */}
              {tasks.length > 0 && (
                <div>
                  <label className="text-sm text-gray-600 block mb-1">
                    Dependencies (hold Ctrl/Cmd to select multiple)
                  </label>
                  <select
                    multiple
                    value={formData.dependencies}
                    onChange={handleDepsChange}
                    className="w-full px-4 py-2 border rounded-md h-28"
                  >
                    {tasks.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.title} (P{t.priority} — {t.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Task"}
              </button>
            </form>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-center text-red-500 mb-4">
            {error?.message || "An error occurred"}
          </p>
        )}

        {loading && (
          <p className="text-center text-gray-600">Loading tasks...</p>
        )}

        {!loading && tasks?.length === 0 && (
          <p className="text-center text-gray-500">
            No tasks yet. Create your first task.
          </p>
        )}

        {/* Task List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks?.map((task) => (
            <div
              key={task._id}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md transition"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-semibold">{task.title}</h2>
                <button
                  onClick={() => handleDelete(task._id)}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  Delete
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-3">{task.description}</p>

              <div className="text-xs text-gray-500 grid grid-cols-2 gap-1 mb-3">
                <span>Priority: {task.priority}</span>
                <span>Est: {task.estimatedHours}h</span>
                <span>
                  Retries: {task.retryCount}/{task.maxRetries}
                </span>
                <span>v{task.versionNumber}</span>
                {task.resourceTag && (
                  <span className="col-span-2">Tag: {task.resourceTag}</span>
                )}
              </div>

              {/* Dependencies list */}
              {task.dependencies?.length > 0 && (
                <div className="text-xs text-gray-500 mb-2">
                  Depends on:{" "}
                  {task.dependencies.map((d) => (
                    <span
                      key={d._id || d}
                      className="bg-gray-100 px-1 rounded mr-1"
                    >
                      {d.title || d}
                    </span>
                  ))}
                </div>
              )}

              {/* Status badge + change */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[task.status]}`}
                >
                  {task.status}
                </span>
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task._id, e.target.value)}
                  className="text-xs border rounded px-1 py-1 flex-1"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Retry button — only shown for failed tasks that can still retry */}
              {task.status === "Failed" &&
                task.retryCount < task.maxRetries && (
                  <button
                    onClick={() => handleRetry(task._id)}
                    className="mt-2 w-full text-xs bg-orange-500 text-white py-1 rounded-md hover:bg-orange-600"
                  >
                    Retry ({task.maxRetries - task.retryCount} left)
                  </button>
                )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Task;
