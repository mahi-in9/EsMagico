const AuditLog = require("../models/AuditLog");

const auditLog = async (actor, action, entity, entityId, metadata = {}) => {
  try {
    await AuditLog.create({ actor, action, entity, entityId, metadata });
  } catch (err) {
    console.error("Audit log error:", err.message);
  }
};

module.exports = auditLog;
