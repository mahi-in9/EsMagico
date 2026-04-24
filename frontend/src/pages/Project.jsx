import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createProject, getProjects } from "../app/slice/projectSlice";

function Project() {
  const dispatch = useDispatch();

  const { projects, projectLoading, projectError } = useSelector(
    (state) => state.project,
  );

  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  const [showForm, setShowForm] = useState(false);

  // Fetch projects
  useEffect(() => {
    dispatch(getProjects());
  }, [dispatch]);

  console.log(projects);

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

    try {
      let res = await dispatch(createProject(formData)).unwrap();
      console.log(res);
    } catch (error) {
      console.log(error);
    }
    setShowForm({
      title: "",
      description: "",
    });
  };

  return (
    <div className="h-full bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Projects</h1>

          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "New Project"}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white p-5 rounded-lg shadow mb-6">
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
                className="bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
              >
                Create
              </button>
            </form>
          </div>
        )}

        {/* Loading */}
        {projectLoading && (
          <p className="text-center text-gray-600">Loading projects...</p>
        )}

        {/* Error */}
        {projectError && (
          <p className="text-center text-red-500">
            {projectError?.message || "Failed to load projects"}
          </p>
        )}

        {/* Project List */}
        {!projectLoading && projects?.length === 0 && (
          <p className="text-center text-gray-500">
            No projects found. Create your first project.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects?.map((project) => (
            <div
              key={project._id}
              className="bg-white p-4 rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="text-lg font-semibold mb-1">{project.title}</h2>

              <p className="text-sm text-gray-600 mb-3">
                {project.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Project;
