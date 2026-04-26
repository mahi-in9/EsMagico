const jwt = require("jsonwebtoken");
const Project = require("../models/Project");
const AuditLog = require("../models/AuditLog");
const auditLog = require("../utils/auditLogger");

const createProject = async (req, res, next) => {
  try {
    const { title, description, webhookUrl } = req.body;
    if (!title || !description)
      return res
        .status(400)
        .json({ success: false, message: "Title and description required" });

    const project = await Project.create({
      title,
      description,
      owner: req.user._id,
      webhookUrl: webhookUrl || "",
    });

    await auditLog(req.user._id, "project.created", "Project", project._id, {
      title,
    });

    res
      .status(201)
      .json({ success: true, message: "Project created", data: project });
  } catch (error) {
    next(error);
  }
};

const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { "members.user": req.user._id }],
    }).populate("owner", "name email");

    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("owner", "name email")
      .populate("members.user", "name email");

    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    const uid = req.user._id.toString();
    const isMember =
      project.owner._id.toString() === uid ||
      project.members.some((m) => m.user._id.toString() === uid);
    if (!isMember)
      return res.status(403).json({ success: false, message: "Access denied" });

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

const generateInvite = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    if (project.owner.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ success: false, message: "Only owner can generate invite" });

    const inviteToken = jwt.sign(
      { projectId: project._id },
      process.env.JWT_SECRET,
      { expiresIn: "30m" },
    );
    project.inviteToken = inviteToken;
    project.inviteTokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    await project.save();

    await auditLog(
      req.user._id,
      "invite.generated",
      "Project",
      project._id,
      {},
    );

    res.status(200).json({ success: true, data: { inviteToken } });
  } catch (error) {
    next(error);
  }
};

const joinProject = async (req, res, next) => {
  try {
    const { token } = req.params;
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired invite token" });
    }

    const project = await Project.findById(decoded.projectId);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });

    if (
      project.inviteToken !== token ||
      !project.inviteTokenExpiry ||
      project.inviteTokenExpiry < new Date()
    )
      return res
        .status(400)
        .json({
          success: false,
          message: "Invite token expired or already used",
        });

    const uid = req.user._id.toString();
    const already =
      project.owner.toString() === uid ||
      project.members.some((m) => m.user.toString() === uid);
    if (already)
      return res
        .status(400)
        .json({ success: false, message: "Already a member" });

    project.members.push({ user: req.user._id, role: "member" });
    project.inviteToken = null;
    project.inviteTokenExpiry = null;
    await project.save();

    await auditLog(req.user._id, "member.joined", "Project", project._id, {});

    res
      .status(200)
      .json({ success: true, message: "Joined project", data: project });
  } catch (error) {
    next(error);
  }
};

const updateWebhook = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    if (project.owner.toString() !== req.user._id.toString())
      return res
        .status(403)
        .json({ success: false, message: "Only owner can set webhook" });

    project.webhookUrl = req.body.webhookUrl || "";
    await project.save();
    res
      .status(200)
      .json({
        success: true,
        message: "Webhook updated",
        data: { webhookUrl: project.webhookUrl },
      });
  } catch (error) {
    next(error);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find({ entityId: req.params.id })
      .populate("actor", "name email")
      .sort({ timestamp: -1 })
      .limit(100);
    res.status(200).json({ success: true, data: logs });
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
  updateWebhook,
  getAuditLogs,
};
