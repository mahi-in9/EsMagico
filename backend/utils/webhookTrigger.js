const axios = require("axios");
const Project = require("../models/Project");

const triggerWebhook = async (projectId, task) => {
  const project = await Project.findById(projectId);
  if (!project || !project.webhookUrl) return;

  const payload = {
    event: "task.completed",
    taskId: task._id,
    title: task.title,
    projectId,
    completedAt: new Date().toISOString(),
  };

  const logEntry = {
    taskId: task._id,
    url: project.webhookUrl,
    status: "pending",
    attempts: 0,
    payload,
  };
  project.webhookLogs.push(logEntry);
  await project.save();

  const logId = project.webhookLogs[project.webhookLogs.length - 1]._id;

  let success = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await axios.post(project.webhookUrl, payload, {
        timeout: 5000,
      });
      await Project.updateOne(
        { _id: projectId, "webhookLogs._id": logId },
        {
          $set: {
            "webhookLogs.$.status": "success",
            "webhookLogs.$.attempts": attempt,
            "webhookLogs.$.lastAttemptAt": new Date(),
            "webhookLogs.$.responseStatus": resp.status,
          },
        },
      );
      success = true;
      break;
    } catch (err) {
      if (attempt === 3) {
        await Project.updateOne(
          { _id: projectId, "webhookLogs._id": logId },
          {
            $set: {
              "webhookLogs.$.status": "failed",
              "webhookLogs.$.attempts": attempt,
              "webhookLogs.$.lastAttemptAt": new Date(),
            },
          },
        );
      }
    }
  }
  return success;
};

module.exports = { triggerWebhook };
