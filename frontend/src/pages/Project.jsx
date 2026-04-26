import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  createProject,
  getProjects,
  joinProject,
} from "../app/slice/projectSlice";
import { Link, useNavigate } from "react-router-dom";

const Project = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { projects, projectLoading } = useSelector((s) => s.project);
  const { user } = useSelector((s) => s.auth);

  const [modal, setModal] = useState(null); // "create" | "join" | null
  const [form, setForm] = useState({
    title: "",
    description: "",
    webhookUrl: "",
  });
  const [joinToken, setJoinToken] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    dispatch(getProjects());
  }, [dispatch]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim())
      return setMsg({ text: "Title and description required", type: "error" });
    setCreating(true);
    try {
      await dispatch(createProject(form)).unwrap();
      setForm({ title: "", description: "", webhookUrl: "" });
      setModal(null);
      setMsg({ text: "Project created!", type: "success" });
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);
    } catch (err) {
      setMsg({ text: err?.message || "Failed", type: "error" });
    }
    setCreating(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinToken.trim()) return;
    try {
      const proj = await dispatch(joinProject(joinToken.trim())).unwrap();
      setModal(null);
      setJoinToken("");
      if (proj?._id) navigate(`/project/${proj._id}`);
    } catch (err) {
      setMsg({ text: err?.message || "Invalid token", type: "error" });
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            <p className="text-gray-500 text-sm mt-1">
              {projects?.length || 0} active workspace
              {projects?.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setModal("join")}
              className="px-4 py-2 text-sm border border-white/10 rounded-lg text-gray-300 hover:bg-white/5 transition"
            >
              🔗 Join
            </button>
            <button
              onClick={() => setModal("create")}
              className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition font-medium"
            >
              + New Project
            </button>
          </div>
        </div>

        {msg.text && (
          <div
            className={`mb-4 p-3 rounded-xl text-sm border ${msg.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}
          >
            {msg.text}
          </div>
        )}

        {projectLoading && (
          <div className="text-center py-20 text-gray-600">
            <div className="inline-block w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm">Loading projects...</p>
          </div>
        )}

        {!projectLoading && !projects?.length && (
          <div className="text-center py-24 text-gray-600">
            <p className="text-5xl mb-4">📭</p>
            <p className="text-lg font-medium text-gray-400">No projects yet</p>
            <p className="text-sm mt-1">
              Create one or join with an invite token
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((p) => (
            <Link
              to={`/project/${p._id}`}
              key={p._id}
              className="group bg-white/5 border border-white/8 rounded-2xl p-5 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all block"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold">
                  {p.title[0]?.toUpperCase()}
                </div>
                {p.owner?._id === user?._id && (
                  <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                    Owner
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-white group-hover:text-indigo-300 transition">
                {p.title}
              </h3>
              <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                {p.description}
              </p>
              <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
                <span>👥 {(p.members?.length || 0) + 1} members</span>
                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Modals */}
        {modal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
          >
            <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-white font-semibold">
                  {modal === "create" ? "New Project" : "Join Project"}
                </h2>
                <button
                  onClick={() => {
                    setModal(null);
                    setMsg({ text: "", type: "" });
                  }}
                  className="text-gray-500 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>

              {modal === "create" ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  {[
                    ["title", "text", "Project title *", "e.g. Data Pipeline"],
                    [
                      "description",
                      "text",
                      "Description *",
                      "What does this project do?",
                    ],
                    [
                      "webhookUrl",
                      "url",
                      "Webhook URL",
                      "https://hooks.example.com/...",
                    ],
                  ].map(([k, t, label, ph]) => (
                    <div key={k}>
                      <label className="text-xs text-gray-400 uppercase tracking-wide">
                        {label}
                      </label>
                      <input
                        type={t}
                        value={form[k]}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, [k]: e.target.value }))
                        }
                        placeholder={ph}
                        className="w-full mt-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-indigo-500 transition placeholder-gray-600"
                      />
                    </div>
                  ))}
                  {msg.text && (
                    <p className="text-red-400 text-sm">{msg.text}</p>
                  )}
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition"
                  >
                    {creating ? "Creating..." : "Create Project"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wide">
                      Invite Token
                    </label>
                    <textarea
                      value={joinToken}
                      onChange={(e) => setJoinToken(e.target.value)}
                      placeholder="Paste the full invite JWT token here..."
                      rows={4}
                      className="w-full mt-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono outline-none focus:border-indigo-500 transition placeholder-gray-600 resize-none"
                    />
                  </div>
                  {msg.text && (
                    <p className="text-red-400 text-sm">{msg.text}</p>
                  )}
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm transition"
                  >
                    Join Project
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Project;
