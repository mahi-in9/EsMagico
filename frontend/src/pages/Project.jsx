import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createProject,
  getProjects,
  joinProject,
} from "../app/slice/projectSlice";
import { Link } from "react-router-dom";

function Project() {
  const dispatch = useDispatch();
  const { projects, projectLoading, projectError } = useSelector(
    (state) => state.project,
  );

  const [formData, setFormData] = useState({ title: "", description: "" });
  const [showForm, setShowForm] = useState(false);
  const [joinToken, setJoinToken] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    dispatch(getProjects());
  }, [dispatch]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return;

    try {
      await dispatch(createProject(formData)).unwrap();
      setFormData({ title: "", description: "" });
      setShowForm(false);
    } catch (error) {
      // error already in Redux state
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinToken.trim()) return;
    setJoinError("");
    try {
      await dispatch(joinProject(joinToken.trim())).unwrap();
      setJoinToken("");
      setShowJoin(false);
    } catch (error) {
      setJoinError(error?.message || "Invalid or expired invite token");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowJoin((p) => !p);
                setShowForm(false);
              }}
              className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
            >
              {showJoin ? "Cancel" : "Join Project"}
            </button>
            <button
              onClick={() => {
                setShowForm((p) => !p);
                setShowJoin(false);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {showForm ? "Cancel" : "New Project"}
            </button>
          </div>
        </div>

        {/* Join Form */}
        {showJoin && (
          <div className="bg-white p-5 rounded-lg shadow mb-6">
            <h2 className="text-lg font-medium mb-3">Join via invite token</h2>
            <form onSubmit={handleJoin} className="flex gap-3">
              <input
                type="text"
                placeholder="Paste invite token here"
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Join
              </button>
            </form>
            {joinError && (
              <p className="text-red-500 text-sm mt-2">{joinError}</p>
            )}
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <div className="bg-white p-5 rounded-lg shadow mb-6">
            <h2 className="text-lg font-medium mb-3">Create new project</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <input
                type="text"
                name="title"
                placeholder="Project Title"
                value={formData.title}
                onChange={handleChange}
                className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                name="description"
                placeholder="Project Description"
                value={formData.description}
                onChange={handleChange}
                className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={projectLoading}
                className="bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {projectLoading ? "Creating..." : "Create"}
              </button>
            </form>
          </div>
        )}

        {projectLoading && (
          <p className="text-center text-gray-600">Loading projects...</p>
        )}

        {projectError && (
          <p className="text-center text-red-500">
            {projectError?.message || "Failed to load projects"}
          </p>
        )}

        {!projectLoading && projects?.length === 0 && (
          <p className="text-center text-gray-500">
            No projects yet. Create or join one.
          </p>
        )}

        {/* Project List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            // BUG FIX: was linking to "/project-details" (hardcoded) — must include the project ID
            <Link
              to={`/project/${project._id}`}
              key={project._id}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md transition cursor-pointer"
            >
              <h2 className="text-lg font-semibold mb-1">{project.title}</h2>
              <p className="text-sm text-gray-600 mb-3">
                {project.description}
              </p>
              <p className="text-xs text-gray-400">
                {project.members?.length || 0} member(s)
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Project;
