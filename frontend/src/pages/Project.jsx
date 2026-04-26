import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createProject,
  getProjects,
  joinProject,
  clearProjectError,
} from "../app/slice/projectSlice";
import { Link } from "react-router-dom";

const statusDot = (count) => (
  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
    {count} members
  </span>
);

const Project = () => {
  const dispatch = useDispatch();
  const { projects, projectLoading, projectError } = useSelector(
    (s) => s.project,
  );
  const { user } = useSelector((s) => s.auth);

  const [form, setForm] = useState({
    title: "",
    description: "",
    webhookUrl: "",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinToken, setJoinToken] = useState("");
  const [joinMsg, setJoinMsg] = useState({ text: "", type: "" });
  const [createMsg, setCreateMsg] = useState("");

  useEffect(() => {
    dispatch(getProjects());
  }, [dispatch]);
  useEffect(() => {
    if (projectError) dispatch(clearProjectError());
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim())
      return setCreateMsg("Title and description required");
    try {
      await dispatch(createProject(form)).unwrap();
      setForm({ title: "", description: "", webhookUrl: "" });
      setShowCreate(false);
      setCreateMsg("");
    } catch (err) {
      setCreateMsg(err?.message || "Failed to create project");
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinToken.trim()) return;
    setJoinMsg({ text: "", type: "" });
    try {
      await dispatch(joinProject(joinToken.trim())).unwrap();
      setJoinMsg({ text: "Successfully joined project!", type: "success" });
      setJoinToken("");
      dispatch(getProjects());
    } catch (err) {
      setJoinMsg({
        text: err?.message || "Invalid or expired token",
        type: "error",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowJoin((p) => !p);
                setShowCreate(false);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm transition"
            >
              🔗 Join
            </button>
            <button
              onClick={() => {
                setShowCreate((p) => !p);
                setShowJoin(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition"
            >
              {showCreate ? "Cancel" : "➕ New Project"}
            </button>
          </div>
        </div>

        {/* Join Form */}
        {showJoin && (
          <div className="bg-white p-5 rounded-xl shadow mb-6">
            <h3 className="font-semibold mb-3">Join via Invite Token</h3>
            <form onSubmit={handleJoin} className="flex gap-3">
              <input
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                placeholder="Paste invite token here"
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Join
              </button>
            </form>
            {joinMsg.text && (
              <p
                className={`text-sm mt-2 ${joinMsg.type === "success" ? "text-green-600" : "text-red-500"}`}
              >
                {joinMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white p-5 rounded-xl shadow mb-6">
            <h3 className="font-semibold mb-3">Create New Project</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Project Title *"
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
              />
              <textarea
                placeholder="Project Description *"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
                rows={2}
              />
              <input
                type="url"
                placeholder="Webhook URL (optional)"
                value={form.webhookUrl}
                onChange={(e) =>
                  setForm((p) => ({ ...p, webhookUrl: e.target.value }))
                }
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
              />
              {createMsg && <p className="text-red-500 text-sm">{createMsg}</p>}
              <button
                type="submit"
                disabled={projectLoading}
                className="bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
              >
                {projectLoading ? "Creating..." : "Create Project"}
              </button>
            </form>
          </div>
        )}

        {projectLoading && (
          <p className="text-center text-gray-500 py-8">Loading projects...</p>
        )}

        {!projectLoading && projects?.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-lg font-medium">No projects yet</p>
            <p className="text-sm">
              Create a project or join one with an invite token
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            <Link
              to={`/project/${project._id}`}
              key={project._id}
              className="bg-white p-5 rounded-xl shadow hover:shadow-md transition cursor-pointer block"
            >
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-semibold text-gray-800">
                  {project.title}
                </h2>
                {project.owner?._id === user?._id && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    Owner
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                {project.description}
              </p>
              <div className="flex justify-between items-center">
                {statusDot((project.members?.length || 0) + 1)}
                <span className="text-xs text-gray-400">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Project;
