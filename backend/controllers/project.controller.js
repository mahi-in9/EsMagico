const Project = require("../models/Project");

const createProject = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { title, description } = req.body;
    const project = await Project.create({
      title,
      description,
      owner: userId,
    });
    console.log(project);

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

const getProjects = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const projects = await Project.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    });

    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No projects found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data: projects,
    });
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Project fetched successfully",
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createProject, getProjects, getProjectById };
