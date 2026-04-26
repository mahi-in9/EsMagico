import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { getProjects } from "../app/slice/projectSlice";
import { getTasks } from "../app/slice/taskSlice";

const StatCard = ({ label, value, color }) => (
  <div className={`bg-white p-5 rounded-xl shadow border-l-4 ${color}`}>
    <p className="text-sm text-gray-500">{label}</p>
    <h2 className="text-3xl font-bold mt-1">{value}</h2>
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

  const allTaskCounts = { total: 0, running: 0, completed: 0, failed: 0 };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome, {user?.name} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Manage your workflow orchestration projects
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Projects"
            value={projects?.length || 0}
            color="border-blue-500"
          />
          <StatCard
            label="Active Projects"
            value={projects?.length || 0}
            color="border-green-500"
          />
          <StatCard
            label="You are"
            value={user?.role || "user"}
            color="border-purple-500"
          />
          <StatCard label="Account" value="Active" color="border-teal-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/project")}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-left font-medium transition"
              >
                📁 View All Projects
              </button>
              <button
                onClick={() => {
                  navigate("/project");
                  setTimeout(() => {}, 100);
                }}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-left font-medium transition"
              >
                ➕ Create New Project
              </button>
              <button
                onClick={() => navigate("/project")}
                className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-left font-medium transition"
              >
                🔗 Join Project via Invite
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="text-lg font-semibold mb-4">Recent Projects</h2>
            {projects?.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No projects yet. Create your first project.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {projects?.slice(0, 5).map((p) => (
                  <button
                    key={p._id}
                    onClick={() => navigate(`/project/${p._id}`)}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-left w-full"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{p.title}</p>
                      <p className="text-xs text-gray-500">
                        {p.members?.length || 0} members
                      </p>
                    </div>
                    <span className="text-gray-400">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
