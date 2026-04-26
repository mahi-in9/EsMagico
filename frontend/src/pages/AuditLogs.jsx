import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getAuditLogs } from "../app/slice/projectSlice";

const ACTION_COLOR = {
  "user.signup": "bg-green-100 text-green-700",
  "project.created": "bg-blue-100 text-blue-700",
  "invite.generated": "bg-purple-100 text-purple-700",
  "member.joined": "bg-teal-100 text-teal-700",
  "task.created": "bg-blue-100 text-blue-700",
  "task.updated": "bg-yellow-100 text-yellow-700",
  "task.status_changed": "bg-orange-100 text-orange-700",
  "task.failed": "bg-red-100 text-red-700",
  "task.retried": "bg-orange-100 text-orange-700",
  "task.deleted": "bg-red-100 text-red-700",
};

const AuditLogs = () => {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const { auditLogs, projectLoading } = useSelector((s) => s.project);

  useEffect(() => {
    dispatch(getAuditLogs(projectId));
  }, [dispatch, projectId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link to="/project" className="hover:underline">
            Projects
          </Link>
          <span>/</span>
          <Link to={`/project/${projectId}`} className="hover:underline">
            Project
          </Link>
          <span>/</span>
          <span className="text-gray-800">Audit Logs</span>
        </div>

        <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>

        {projectLoading && (
          <p className="text-center text-gray-500">Loading...</p>
        )}

        {!projectLoading && auditLogs.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📋</p>
            <p>No audit logs yet</p>
          </div>
        )}

        <div className="space-y-2">
          {auditLogs.map((log) => (
            <div
              key={log._id}
              className="bg-white p-4 rounded-xl shadow flex gap-4 items-start"
            >
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap shrink-0 ${ACTION_COLOR[log.action] || "bg-gray-100 text-gray-700"}`}
              >
                {log.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {log.actor?.name || "System"}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {log.entity} · {log.entityId}
                </p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {JSON.stringify(log.metadata)}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
