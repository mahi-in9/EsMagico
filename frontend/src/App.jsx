import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchUser, setAuthChecked } from "./app/slice/authSlice";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Project from "./pages/Project";
import ProjectDetails from "./pages/ProjectDetails";
import AuditLogs from "./pages/AuditLogs";

const Loader = () => (
  <div className="h-screen flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user, isAuthChecked } = useSelector((s) => s.auth);
  const location = useLocation();
  if (!isAuthChecked) return <Loader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, isAuthChecked } = useSelector((s) => s.auth);
  if (!isAuthChecked) return <Loader />;
  if (user) return <Navigate to="/" replace />;
  return children;
};

function App() {
  const dispatch = useDispatch();
  const { isAuthChecked } = useSelector((s) => s.auth);

  useEffect(() => {
    if (!isAuthChecked) {
      if (localStorage.getItem("token")) {
        // Token exists, fetch the user data
        dispatch(fetchUser());
      } else {
        // No token exists, instantly tell the app we are done checking!
        dispatch(setAuthChecked());
      }
    }
  }, [dispatch, isAuthChecked]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
