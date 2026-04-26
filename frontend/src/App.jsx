import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchUser } from "./app/slice/authSlice";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Project from "./pages/Project";
import ProjectDetails from "./pages/ProjectDetails";
import AuditLogs from "./pages/AuditLogs";

// Protected route wrapper
const PrivateRoute = ({ children }) => {
  const { user, isAuthChecked } = useSelector((s) => s.auth);
  const location = useLocation();
  if (!isAuthChecked)
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

// Public route — redirect to home if already logged in
const PublicRoute = ({ children }) => {
  const { user, isAuthChecked } = useSelector((s) => s.auth);
  if (!isAuthChecked)
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  if (user) return <Navigate to="/" replace />;
  return children;
};

function App() {
  const dispatch = useDispatch();
  const { isAuthChecked } = useSelector((s) => s.auth);

  // Bootstrap auth on every load
  useEffect(() => {
    if (!isAuthChecked && localStorage.getItem("token")) {
      dispatch(fetchUser());
    }
  }, [dispatch, isAuthChecked]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <Signup />
              </PublicRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            }
          />
          <Route
            path="/project"
            element={
              <PrivateRoute>
                <Project />
              </PrivateRoute>
            }
          />
          <Route
            path="/project/:projectId"
            element={
              <PrivateRoute>
                <ProjectDetails />
              </PrivateRoute>
            }
          />
          <Route
            path="/project/:projectId/audit"
            element={
              <PrivateRoute>
                <AuditLogs />
              </PrivateRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
