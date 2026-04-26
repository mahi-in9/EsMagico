import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getProjects } from "../app/slice/projectSlice";

const Stat = ({ n, label, color }) => (
  <div className="bg-white/5 border border-white/8 rounded-xl p-4">
    <div className={`text-3xl font-bold ${color}`}>{n}</div>
    <div className="text-gray-400 text-sm mt-1">{label}</div>
  </div>
);

const Home = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { projects } = useSelector((s) => s.project);

  useEffect(() => {
    dispatch(getProjects());
  }, [dispatch]);

  const now = new Date().getHours();
  const greeting =
    now < 12 ? "Good morning" : now < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="mb-10">
          <p className="text-indigo-400 text-sm font-medium mb-1">
            {greeting} 👋
          </p>
          <h1 className="text-3xl font-bold text-white">{user?.name}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Workflow Orchestration Dashboard
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Stat
            n={projects?.length || 0}
            label="Projects"
            color="text-indigo-400"
          />
          <Stat
            n={user?.role === "admin" ? "Admin" : "Member"}
            label="Role"
            color="text-violet-400"
          />
          <Stat n="Live" label="Real-time sync" color="text-green-400" />
          <Stat n="v2" label="Engine" color="text-cyan-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick actions */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
              Quick Actions
            </h2>
            <div className="space-y-2">
              {[
                {
                  icon: "📁",
                  label: "View all projects",
                  sub: "See your workflow projects",
                  action: () => navigate("/project"),
                },
                {
                  icon: "➕",
                  label: "Create project",
                  sub: "Start a new orchestration",
                  action: () => navigate("/project"),
                },
                {
                  icon: "🔗",
                  label: "Join via invite",
                  sub: "Use a team invite token",
                  action: () => navigate("/project"),
                },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={a.action}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-left group"
                >
                  <span className="text-xl">{a.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition">
                      {a.label}
                    </p>
                    <p className="text-xs text-gray-500">{a.sub}</p>
                  </div>
                  <span className="ml-auto text-gray-600 group-hover:text-gray-400">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent projects */}
          <div className="bg-white/5 border border-white/8 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4">
              Recent Projects
            </h2>
            {!projects?.length ? (
              <div className="text-center py-8 text-gray-600">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">No projects yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.slice(0, 5).map((p) => (
                  <button
                    key={p._id}
                    onClick={() => navigate(`/project/${p._id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm">
                      {p.title[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {p.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(p.members?.length || 0) + 1} member
                        {(p.members?.length || 0) + 1 !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-gray-600 group-hover:text-gray-400 text-sm">
                      →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Feature callout */}
        <div className="mt-6 p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
          <div className="flex items-start gap-4">
            <div className="text-2xl">⚡</div>
            <div>
              <h3 className="text-white font-semibold text-sm">
                Parallel Execution Engine
              </h3>
              <p className="text-gray-400 text-xs mt-1">
                The orchestration engine detects tasks that can run in parallel,
                respects resource tags to prevent conflicts, and computes
                optimal execution plans using Kahn's topological sort algorithm.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
