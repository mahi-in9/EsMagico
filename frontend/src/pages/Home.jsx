import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUser } from "../app/slice/authSlice";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { user, loading, isAuthChecked } = useSelector((state) => state.auth);

  // Bootstrap auth on page load
  useEffect(() => {
    if (!isAuthChecked) {
      dispatch(fetchUser());
    }
  }, [dispatch, isAuthChecked]);

  // Redirect if not logged in
  useEffect(() => {
    if (isAuthChecked && !user) {
      navigate("/login");
    }
  }, [user, isAuthChecked, navigate]);

  // Loading state (important to avoid flicker)
  if (!isAuthChecked || loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-600 text-lg">Loading...</p>
      </div>
    );
  }

  // Main dashboard UI
  return (
    <div className="h-full bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">
            Welcome, {user?.name || "User"}
          </h1>
          <p className="text-gray-600 text-sm">
            Manage your projects and tasks efficiently
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Total Projects</p>
            <h2 className="text-xl font-semibold">0</h2>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Active Tasks</p>
            <h2 className="text-xl font-semibold">0</h2>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">Completed Tasks</p>
            <h2 className="text-xl font-semibold">0</h2>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>

          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => navigate("/projects")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Project
            </button>

            <button
              onClick={() => navigate("/tasks")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Create Task
            </button>
          </div>
        </div>

        {/* Placeholder for future sections */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Recent Activity</h2>
          <p className="text-gray-500 text-sm">No recent activity yet</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
