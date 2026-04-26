import { BrowserRouter, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Signup from "./pages/Signup";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Project from "./pages/Project";
import Task from "./pages/Task";
import ProjectDetails from "./pages/ProjectDetails";

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/projects" element={<Project />} />
          <Route path="/project/:projectId" element={<ProjectDetails />} />
          <Route path="/project/:projectId/task" element={<Task />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
