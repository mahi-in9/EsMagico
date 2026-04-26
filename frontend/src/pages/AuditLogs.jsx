import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getAuditLogs } from "../app/slice/projectSlice";

const COLORS = {
  "user.signup": "text-green-400 bg-green-500/10 border-green-500/20",
  "project.created": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "invite.generated": "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "member.joined": "text-teal-400 bg-teal-500/10 border-teal-500/20",
  "task.created": "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  "task.updated": "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  "task.status_changed":
    "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "task.failed": "text-red-400 bg-red-500/10 border-red-500/20",
  "task.retried": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "task.deleted": "text-red-400 bg-red-500/10 border-red-500/20",
};

const AuditLogs = () => {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const { auditLogs, projectLoading } = useSelector((s) => s.project);

  useEffect(() => {
    dispatch(getAuditLogs(projectId));
  }, [dispatch, projectId]);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-6">
          <Link to="/project" className="hover:text-gray-400 transition">
            Projects
          </Link>
          <span>/</span>
          <Link
            to={`/project/${projectId}`}
            className="hover:text-gray-400 transition"
          >
            Project
          </Link>
          <span>/</span>
          <span className="text-gray-400">Audit Logs</span>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Audit Trail</h1>
            <p className="text-gray-500 text-xs mt-1">
              {auditLogs.length} events recorded
            </p>
          </div>
          <button
            onClick={() => dispatch(getAuditLogs(projectId))}
            className="px-3 py-1.5 border border-white/10 text-xs text-gray-400 hover:text-white rounded-lg transition"
          >
            Refresh
          </button>
        </div>

        {projectLoading && (
          <div className="text-center py-20 text-gray-600">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!projectLoading && !auditLogs.length && (
          <div className="text-center py-20 text-gray-600">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm text-gray-400">No audit events yet</p>
          </div>
        )}

        <div className="space-y-2">
          {auditLogs.map((log) => (
            <div
              key={log._id}
              className="bg-white/5 border border-white/8 rounded-xl p-4 flex items-start gap-4 hover:border-white/12 transition"
            >
              <span
                className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap shrink-0 ${COLORS[log.action] || "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}
              >
                {log.action}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {log.actor?.name || "System"}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {log.entity} • {log.entityId}
                </p>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <p className="text-xs text-gray-600 font-mono mt-1 truncate">
                    {JSON.stringify(log.metadata)}
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-600 whitespace-nowrap shrink-0">
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
