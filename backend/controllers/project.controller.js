const Project = require("../models/Project");
const jwt = require("jsonwebtoken");

const createProject = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required",
      });
    }

    const project = await Project.create({
      title,
      description,
      owner: userId,
    });

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
    }).populate("owner", "name email");

    // Return empty array instead of 404 — no projects is not an error
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
    // BUG FIX: was req.params.projectId — route param is :id
    const projectId = req.params.id;

    const project = await Project.findById(projectId)
      .populate("owner", "name email")
      .populate("members.user", "name email");

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Only owner or members can view
    const userId = req.user._id.toString();
    const isMember =
      project.owner._id.toString() === userId ||
      project.members.some((m) => m.user._id.toString() === userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
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

const generateInvite = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Only owner can generate invite
    if (project.owner.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Only the owner can generate invites",
        });
    }

    // Sign a JWT as the invite token — expires in 30 minutes
    const inviteToken = jwt.sign(
      { projectId: project._id },
      process.env.JWT_SECRET,
      { expiresIn: "30m" },
    );

    project.inviteToken = inviteToken;
    project.inviteTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await project.save();

    res.status(200).json({
      success: true,
      message: "Invite token generated",
      data: { inviteToken },
    });
  } catch (error) {
    next(error);
  }
};

const joinProject = async (req, res, next) => {
  try {
    const { token } = req.params;
    const userId = req.user._id;

    // Verify the JWT invite token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired invite token" });
    }

    const project = await Project.findById(decoded.projectId);
    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    // Check token matches what's stored and hasn't expired
    if (
      project.inviteToken !== token ||
      !project.inviteTokenExpiry ||
      project.inviteTokenExpiry < new Date()
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invite token is invalid or has expired",
        });
    }

    // Don't add owner or existing members again
    const alreadyMember =
      project.owner.toString() === userId.toString() ||
      project.members.some((m) => m.user.toString() === userId.toString());

    if (alreadyMember) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You are already a member of this project",
        });
    }

    project.members.push({ user: userId, role: "member" });
    // Invalidate token after use
    project.inviteToken = null;
    project.inviteTokenExpiry = null;
    await project.save();

    res.status(200).json({
      success: true,
      message: "Successfully joined the project",
      data: project,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  generateInvite,
  joinProject,
};
