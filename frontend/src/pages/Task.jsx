import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createTask, getTasks } from "../app/slice/taskSlice";

function Task() {
  const dispatch = useDispatch();

  const { tasks, loading, error } = useSelector((state) => state.task);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  const [showForm, setShowForm] = useState(false);

  // Fetch tasks
  useEffect(() => {
    dispatch(getTasks());
  }, [dispatch]);

  // Handle input
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) return;

    const result = await dispatch(createTask(formData));

    if (createTask.fulfilled.match(result)) {
      setFormData({ title: "", description: "" });
      setShowForm(false);
    }
  };

  return (
    <div className="h-full bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Tasks</h1>

          <button
            onClick={() => setShowForm((prev) => !prev)}
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

        {/* Status Handling */}
        {loading ? (
          <p className="text-center text-gray-600">Loading tasks...</p>
        ) : error ? (
          <p className="text-center text-red-500">
            {error?.message || "Failed to load tasks"}
          </p>
        ) : tasks?.length === 0 ? (
          <p className="text-center text-gray-500">
            No tasks found. Create your first task.
          </p>
        ) : null}

        {/* Task List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks?.map((task) => (
            <div
              key={task._id}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="text-lg font-semibold mb-1">{task.title}</h2>

              <p className="text-sm text-gray-600 mb-3">{task.description}</p>

              <div className="text-xs text-gray-500 flex justify-between">
                <span>Status: {task.status || "Pending"}</span>
                <span>Priority: {task.priority || "Low"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Task;
