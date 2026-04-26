import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { io } from "socket.io-client";
import {
  getProjectById,
  generateInvite,
  clearInviteToken,
  computeExecution,
  runSimulation,
  clearExecutionPlan,
  clearSimulation,
  updateWebhook,
} from "../app/slice/projectSlice";
import {
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  retryTask,
  deleteTask,
  clearConflictError,
  socketTaskCreated,
  socketTaskUpdated,
  socketTaskStatusChanged,
  socketTaskDeleted,
} from "../app/slice/taskSlice";

/* ─── constants ──────────────────────────────────────────── */
const SC = {
  Pending: { bg: "bg-gray-500/15", text: "text-gray-300", dot: "bg-gray-400" },
  Running: { bg: "bg-blue-500/15", text: "text-blue-300", dot: "bg-blue-400" },
  Completed: {
    bg: "bg-green-500/15",
    text: "text-green-300",
    dot: "bg-green-400",
  },
  Failed: { bg: "bg-red-500/15", text: "text-red-300", dot: "bg-red-400" },
  Blocked: {
    bg: "bg-yellow-500/15",
    text: "text-yellow-300",
    dot: "bg-yellow-400",
  },
};
const STATUSES = ["Pending", "Running", "Completed", "Failed", "Blocked"];
const TABS = ["tasks", "execution", "simulation", "members", "settings"];
const EMPTY_FORM = {
  title: "",
  description: "",
  priority: 3,
  estimatedHours: 1,
  resourceTag: "",
  maxRetries: 3,
  dependencies: [],
};

/* ─── helper components ──────────────────────────────────── */
const Badge = ({ status }) => {
  const s = SC[status] || SC.Pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
};

/* ─── Dependency Selector — THE FIX ─────────────────────── */
/* Native <select multiple> value binding is unreliable with string IDs.
   We build a custom checkbox list instead — no binding issues. */
const DepSelector = ({ allTasks, excludeId, selected, onChange }) => {
  const choices = allTasks.filter((t) => t._id !== excludeId);
  if (!choices.length)
    return <p className="text-xs text-gray-600 italic">No other tasks yet</p>;

  const toggle = (id) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
      {choices.map((t) => {
        const checked = selected.includes(t._id);
        return (
          <label
            key={t._id}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-white/5 ${checked ? "bg-indigo-600/10" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(t._id)}
              className="accent-indigo-500 w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-200 flex-1 truncate">
              {t.title}
            </span>
            <span className="text-xs text-gray-500">P{t.priority}</span>
            <Badge status={t.status} />
          </label>
        );
      })}
    </div>
  );
};

/* ─── DAG Visualiser ─────────────────────────────────────── */
const DagView = ({ tasks }) => {
  if (!tasks.length) return null;
  const taskMap = Object.fromEntries(tasks.map((t) => [t._id, t]));

  // Simple left-to-right levels via BFS from roots
  const level = {};
  const roots = tasks.filter((t) => !t.dependencies?.length);
  const queue = [...roots];
  roots.forEach((t) => {
    level[t._id] = 0;
  });
  while (queue.length) {
    const cur = queue.shift();
    tasks.forEach((t) => {
      if ((t.dependencies || []).some((d) => (d._id || d) === cur._id)) {
        level[t._id] = Math.max(level[t._id] ?? -1, (level[cur._id] ?? 0) + 1);
        queue.push(t);
      }
    });
  }
  tasks.forEach((t) => {
    if (level[t._id] === undefined) level[t._id] = 0;
  });

  const cols = {};
  Object.entries(level).forEach(([id, lv]) => {
    if (!cols[lv]) cols[lv] = [];
    cols[lv].push(id);
  });

  const colW = 160,
    rowH = 56,
    padX = 20,
    padY = 16;
  const maxCols = Object.keys(cols).length;
  const maxRows = Math.max(...Object.values(cols).map((a) => a.length));
  const W = maxCols * colW + padX * 2;
  const H = maxRows * rowH + padY * 2;

  const pos = {};
  Object.entries(cols).forEach(([lv, ids]) => {
    ids.forEach((id, i) => {
      pos[id] = {
        x: padX + lv * colW + colW / 2,
        y: padY + i * rowH + rowH / 2,
      };
    });
  });

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        <defs>
          <marker
            id="arr"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path
              d="M2 2L8 5L2 8"
              fill="none"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </marker>
        </defs>
        {/* Edges */}
        {tasks.map((t) =>
          (t.dependencies || []).map((dep) => {
            const depId = dep._id || dep;
            const from = pos[depId],
              to = pos[t._id];
            if (!from || !to) return null;
            const mx = (from.x + to.x) / 2;
            return (
              <path
                key={`${depId}->${t._id}`}
                d={`M${from.x} ${from.y} C${mx} ${from.y} ${mx} ${to.y} ${to.x - 55} ${to.y}`}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="1.5"
                opacity="0.6"
                markerEnd="url(#arr)"
                strokeDasharray="4 2"
              />
            );
          }),
        )}
        {/* Nodes */}
        {tasks.map((t) => {
          const p = pos[t._id];
          if (!p) return null;
          const sc = SC[t.status] || SC.Pending;
          return (
            <g key={t._id}>
              <rect
                x={p.x - 55}
                y={p.y - 16}
                width={110}
                height={32}
                rx={8}
                fill="#1e2130"
                stroke="#374151"
                strokeWidth={1}
              />
              <circle
                cx={p.x - 42}
                cy={p.y}
                r={4}
                className={sc.dot.replace("bg-", "fill-")}
                fill="#22c55e"
              />
              <text
                x={p.x - 34}
                y={p.y}
                dominantBaseline="middle"
                fill="#e2e8f0"
                fontSize={10}
                fontFamily="monospace"
              >
                {t.title.length > 10 ? t.title.slice(0, 10) + "…" : t.title}
              </text>
              <text
                x={p.x + 42}
                y={p.y}
                dominantBaseline="middle"
                fill="#6b7280"
                fontSize={9}
                textAnchor="end"
              >
                P{t.priority}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ─── Simulation Terminal ─────────────────────────────────── */
const Terminal = ({ projectId, tasks }) => {
  const dispatch = useDispatch();
  const { actionLoading, simulationResult } = useSelector((s) => s.project);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState([
    "EsMagico Orchestrator v2.0",
    "Type 'help' for available commands.",
    "",
  ]);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const termRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (termRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  useEffect(() => {
    if (simulationResult?.log) {
      setLines((prev) => [...prev, ...simulationResult.log, ""]);
    }
  }, [simulationResult]);

  const push = (...newLines) => setLines((prev) => [...prev, ...newLines]);

  const run = async (raw) => {
    const cmd = raw.trim();
    if (!cmd) return;
    const parts = cmd.split(/\s+/);
    const verb = parts[0].toLowerCase();
    push(`$ ${cmd}`, "");

    if (verb === "help") {
      push(
        "Commands:",
        "  simulate <hours>          Run simulation for N hours",
        "  simulate <hours> fail:<id1>,<id2>  Simulate with pre-failed tasks",
        "  plan                      Show execution plan steps",
        "  tasks                     List all tasks",
        "  clear                     Clear terminal",
        "  help                      Show this message",
        "",
      );
      return;
    }

    if (verb === "clear") {
      setLines([""]);
      return;
    }

    if (verb === "tasks") {
      if (!tasks.length) {
        push("No tasks in this project.", "");
        return;
      }
      tasks.forEach((t, i) =>
        push(
          `  [${i + 1}] ${t.title.padEnd(24)} P${t.priority}  ${t.estimatedHours}h  [${t.status}]  id:${t._id}`,
        ),
      );
      push("");
      return;
    }

    if (verb === "plan") {
      push("Computing execution plan...", "");
      const result = await dispatch(computeExecution(projectId));
      if (result.payload?.steps) {
        result.payload.steps.forEach((step) => {
          push(
            `  Step ${step.step}: ${step.parallel ? "⚡ PARALLEL" : "▶ SEQ"}`,
          );
          step.tasks.forEach((t) =>
            push(`    • ${t.title}  (P${t.priority} · ${t.estimatedHours}h)`),
          );
        });
        if (result.payload.blockedTasks?.length)
          result.payload.blockedTasks.forEach((t) =>
            push(`  ❌ ${t.title}  [BLOCKED]`),
          );
        push("");
      } else {
        push("Failed to compute plan.", "");
      }
      return;
    }

    if (verb === "simulate") {
      const hours = parseFloat(parts[1]);
      if (!hours || isNaN(hours)) {
        push("Usage: simulate <hours>", "");
        return;
      }
      const failPart = parts.find((p) => p.startsWith("fail:"));
      const failedTaskIds = failPart
        ? failPart.replace("fail:", "").split(",").filter(Boolean)
        : [];
      push(`Running simulation for ${hours}h...`, "");
      await dispatch(
        runSimulation({
          id: projectId,
          body: { availableHours: hours, failedTaskIds },
        }),
      );
      return;
    }

    push(`Unknown command: '${verb}'. Type 'help'.`, "");
  };

  const handleKey = (e) => {
    if (e.key === "Enter") {
      const cmd = input.trim();
      if (cmd) {
        setCmdHistory((h) => [cmd, ...h]);
        setHistIdx(-1);
      }
      run(cmd);
      setInput("");
    } else if (e.key === "ArrowUp") {
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx] || "");
    } else if (e.key === "ArrowDown") {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : cmdHistory[idx] || "");
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Title bar */}
      <div className="bg-[#1a1d27] px-4 py-2.5 flex items-center gap-2 border-b border-white/8">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-gray-400 text-xs font-mono ml-2">
          esm@engine:~$ orchestrator
        </span>
        {actionLoading && (
          <span className="ml-auto text-xs text-yellow-400 animate-pulse">
            running...
          </span>
        )}
      </div>
      {/* Output */}
      <div
        ref={termRef}
        onClick={() => inputRef.current?.focus()}
        className="bg-[#0d0f18] font-mono text-xs leading-6 p-4 h-80 overflow-y-auto cursor-text"
      >
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.startsWith("$")
                ? "text-indigo-300"
                : l.startsWith("[ENGINE]") ||
                    l.startsWith("[CONFIG]") ||
                    l.startsWith("[RESULT]")
                  ? "text-cyan-400"
                  : l.startsWith("   ✅")
                    ? "text-green-400"
                    : l.startsWith("   ⏭")
                      ? "text-yellow-400"
                      : l.startsWith("   ❌")
                        ? "text-red-400"
                        : l.startsWith("   ▶️") || l.startsWith("   ⚡")
                          ? "text-blue-400"
                          : l.startsWith("─")
                            ? "text-gray-700"
                            : "text-gray-300"
            }
          >
            {l || "\u00a0"}
          </div>
        ))}
        {actionLoading && (
          <div className="text-yellow-400 animate-pulse">computing...</div>
        )}
      </div>
      {/* Input */}
      <div className="bg-[#0d0f18] border-t border-white/8 flex items-center gap-2 px-4 py-2.5">
        <span className="text-green-400 font-mono text-xs">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={actionLoading}
          placeholder={
            actionLoading
              ? "running..."
              : "simulate 8  |  plan  |  tasks  |  help"
          }
          className="flex-1 bg-transparent text-green-300 text-xs font-mono outline-none placeholder-gray-700 disabled:opacity-50"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <span className="cursor" />
      </div>
    </div>
  );
};

/* ─── Execution Plan Steps ────────────────────────────────── */
const ExecutionSteps = ({ steps, blockedTasks }) => (
  <div className="space-y-3">
    {steps?.map((step) => (
      <div
        key={step.step}
        className="bg-white/5 border border-white/8 rounded-xl p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {step.step}
          </div>
          <span className="text-sm font-medium text-white">
            Step {step.step}
          </span>
          {step.parallel && (
            <span className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full ml-1">
              ⚡ {step.tasks.length} in parallel
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {step.tasks.map((t) => (
            <div
              key={t._id}
              className="flex items-center gap-2 bg-[#1a1d27] border border-white/8 rounded-lg px-3 py-1.5"
            >
              <Badge status={t.status} />
              <span className="text-sm text-gray-200">{t.title}</span>
              <span className="text-xs text-gray-500">P{t.priority}</span>
              <span className="text-xs text-gray-600">{t.estimatedHours}h</span>
            </div>
          ))}
        </div>
      </div>
    ))}
    {blockedTasks?.length > 0 && (
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
        <p className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-2">
          🚫 Blocked ({blockedTasks.length})
        </p>
        <div className="space-y-1">
          {blockedTasks.map((t) => (
            <div key={t._id} className="flex justify-between text-sm">
              <span className="text-gray-300">{t.title}</span>
              <Badge status={t.status} />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

/* ─── Task Card ──────────────────────────────────────────── */
const TaskCard = ({ task, onEdit, onDelete, onStatusChange, onRetry }) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusError, setStatusError] = useState("");

  const handleStatus = async (s) => {
    setStatusOpen(false);
    setStatusError("");
    const result = await onStatusChange(task, s);
    if (result?.error)
      setStatusError(result.error.message || "Status update failed");
  };

  return (
    <div className="bg-white/5 border border-white/8 rounded-xl p-4 flex flex-col gap-3 hover:border-indigo-500/30 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <h3 className="font-semibold text-white text-sm leading-tight flex-1">
          {task.title}
        </h3>
        <Badge status={task.status} />
      </div>

      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
        {task.description}
      </p>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <div className="flex items-center gap-1 text-gray-400">
          <span>🎯</span>
          <span>P{task.priority}/5</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <span>⏱</span>
          <span>{task.estimatedHours}h</span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <span>🔄</span>
          <span>
            {task.retryCount}/{task.maxRetries} retries
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <span>📌</span>
          <span>v{task.versionNumber}</span>
        </div>
        {task.resourceTag && (
          <div className="col-span-2 flex items-center gap-1 text-gray-400">
            <span>🏷</span>
            <span className="font-mono text-indigo-300">
              {task.resourceTag}
            </span>
          </div>
        )}
      </div>

      {/* Dependencies */}
      {task.dependencies?.length > 0 && (
        <div>
          <p className="text-xs text-gray-600 mb-1.5">Depends on:</p>
          <div className="flex flex-wrap gap-1">
            {task.dependencies.map((d) => (
              <span
                key={d._id || d}
                className="text-xs bg-indigo-600/15 border border-indigo-500/25 text-indigo-300 px-2 py-0.5 rounded-full"
              >
                {d.title || d}
              </span>
            ))}
          </div>
        </div>
      )}

      {statusError && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">
          {statusError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        {/* Status dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setStatusOpen((p) => !p)}
            className="w-full text-left text-xs px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:border-white/20 transition flex items-center justify-between gap-1"
          >
            Change status
            <span className="text-gray-600">▾</span>
          </button>
          {statusOpen && (
            <div className="absolute bottom-full mb-1 left-0 right-0 z-20 bg-[#1a1d27] border border-white/10 rounded-lg overflow-hidden shadow-2xl">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition flex items-center gap-2 ${task.status === s ? "text-indigo-400" : "text-gray-300"}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${SC[s]?.dot || "bg-gray-400"}`}
                  />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onEdit(task)}
          className="text-xs px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 transition"
        >
          ✏
        </button>
        <button
          onClick={() => onDelete(task)}
          className="text-xs px-2.5 py-1.5 bg-white/5 border border-red-500/20 rounded-lg text-red-500 hover:bg-red-500/10 transition"
        >
          🗑
        </button>
      </div>

      {task.status === "Failed" && task.retryCount < task.maxRetries && (
        <button
          onClick={() => onRetry(task)}
          className="w-full text-xs bg-orange-600/20 border border-orange-500/30 text-orange-300 py-1.5 rounded-lg hover:bg-orange-600/30 transition"
        >
          ↩ Retry ({task.maxRetries - task.retryCount} left)
        </button>
      )}
    </div>
  );
};

/* ─── MAIN COMPONENT ──────────────────────────────────────── */
const ProjectDetails = () => {
  const { projectId } = useParams();
  const dispatch = useDispatch();
  const socketRef = useRef(null);

  const {
    currentProject,
    inviteToken,
    executionPlan,
    simulationResult,
    actionLoading,
  } = useSelector((s) => s.project);
  const {
    tasks,
    loading: taskLoading,
    error: taskError,
    conflictError,
  } = useSelector((s) => s.task);
  const { user } = useSelector((s) => s.auth);

  const [tab, setTab] = useState("tasks");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [simForm, setSimForm] = useState({
    availableHours: 8,
    failedTaskIds: "",
  });
  const [webhookInput, setWebhookInput] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [statusErrors, setStatusErrors] = useState({});

  useEffect(() => {
    dispatch(getProjectById(projectId));
    dispatch(getTasks(projectId));
  }, [dispatch, projectId]);

  useEffect(() => {
    if (currentProject?.webhookUrl !== undefined)
      setWebhookInput(currentProject.webhookUrl || "");
  }, [currentProject?.webhookUrl]);

  // WebSocket
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL, {
      auth: { token: localStorage.getItem("token") },
    });
    socketRef.current = socket;
    socket.emit("join:project", projectId);
    socket.on("task:created", (task) => dispatch(socketTaskCreated(task)));
    socket.on("task:updated", (task) => dispatch(socketTaskUpdated(task)));
    socket.on("task:statusChanged", (data) =>
      dispatch(socketTaskStatusChanged(data)),
    );
    socket.on("task:retried", ({ taskId, task }) =>
      dispatch(socketTaskStatusChanged({ taskId, status: "Pending", task })),
    );
    socket.on("task:deleted", (data) => dispatch(socketTaskDeleted(data)));
    return () => {
      socket.emit("leave:project", projectId);
      socket.disconnect();
    };
  }, [projectId, dispatch]);

  const isOwner =
    currentProject?.owner?._id === user?._id ||
    currentProject?.owner === user?._id;

  /* ─ form helpers ─ */
  const openCreate = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (task) => {
    setEditingTask(task);
    // ★ THE FIX: extract plain string IDs from populated dependency objects
    const depIds = (task.dependencies || []).map((d) =>
      typeof d === "object" ? d._id : d,
    );
    setForm({
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      resourceTag: task.resourceTag || "",
      maxRetries: task.maxRetries,
      dependencies: depIds, // ← plain string IDs, not objects
      versionNumber: task.versionNumber,
    });
    setFormError("");
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  // Called by DepSelector checkbox list
  const handleDepsChange = useCallback((ids) => {
    setForm((p) => ({ ...p, dependencies: ids }));
  }, []);

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim())
      return setFormError("Title and description are required");

    const payload = {
      ...form,
      priority: Number(form.priority),
      estimatedHours: Number(form.estimatedHours),
      maxRetries: Number(form.maxRetries),
      // dependencies is already a plain string[] from DepSelector
    };

    if (editingTask) {
      payload.versionNumber = editingTask.versionNumber;
      const r = await dispatch(
        updateTask({ projectId, taskId: editingTask._id, taskData: payload }),
      );
      if (updateTask.rejected.match(r))
        return setFormError(r.payload?.message || "Update failed");
    } else {
      const r = await dispatch(createTask({ projectId, taskData: payload }));
      if (createTask.rejected.match(r))
        return setFormError(r.payload?.message || "Create failed");
    }
    setShowForm(false);
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const handleStatusChange = async (task, status) => {
    const result = await dispatch(
      updateTaskStatus({ projectId, taskId: task._id, status }),
    );
    if (updateTaskStatus.rejected.match(result)) {
      setStatusErrors((p) => ({
        ...p,
        [task._id]: result.payload?.message || "Failed",
      }));
      setTimeout(
        () =>
          setStatusErrors((p) => {
            const n = { ...p };
            delete n[task._id];
            return n;
          }),
        4000,
      );
    }
    return result;
  };

  const handleRetry = (task) =>
    dispatch(retryTask({ projectId, taskId: task._id }));
  const handleDelete = (task) => {
    if (window.confirm(`Delete "${task.title}"?`))
      dispatch(deleteTask({ projectId, taskId: task._id }));
  };
  const handleGenerateInvite = () => dispatch(generateInvite(projectId));
  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteToken);
    setCopyMsg("Copied!");
    setTimeout(() => setCopyMsg(""), 2000);
  };
  const handleComputeExecution = () => dispatch(computeExecution(projectId));
  const handleSimulate = (e) => {
    e.preventDefault();
    const failedIds = simForm.failedTaskIds.trim()
      ? simForm.failedTaskIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    dispatch(
      runSimulation({
        id: projectId,
        body: {
          availableHours: Number(simForm.availableHours),
          failedTaskIds: failedIds,
        },
      }),
    );
  };
  const handleWebhookSave = (e) => {
    e.preventDefault();
    dispatch(updateWebhook({ id: projectId, webhookUrl: webhookInput }));
  };

  const inputCls =
    "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition placeholder-gray-600";
  const labelCls = "block text-xs text-gray-400 uppercase tracking-wide mb-1";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0f1117]/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
            <Link to="/project" className="hover:text-gray-400 transition">
              Projects
            </Link>
            <span>/</span>
            <span className="text-gray-400">
              {currentProject?.title || "Loading..."}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">
                {currentProject?.title}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {currentProject?.description}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                to={`/project/${projectId}/audit`}
                className="px-3 py-1.5 text-xs border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/20 transition"
              >
                📋 Audit
              </Link>
              {isOwner && (
                <button
                  onClick={handleGenerateInvite}
                  className="px-3 py-1.5 text-xs bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-lg hover:bg-violet-600/30 transition"
                >
                  🔗 Invite
                </button>
              )}
            </div>
          </div>

          {inviteToken && (
            <div className="mt-3 p-3 bg-violet-600/10 border border-violet-500/20 rounded-xl flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-violet-400 font-medium mb-1">
                  Invite token — valid 30 min
                </p>
                <p className="text-xs text-gray-400 font-mono break-all">
                  {inviteToken}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleCopyInvite}
                  className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-500 transition whitespace-nowrap"
                >
                  {copyMsg || "Copy"}
                </button>
                <button
                  onClick={() => dispatch(clearInviteToken())}
                  className="px-3 py-1.5 border border-white/10 text-gray-400 rounded-lg text-xs hover:text-white transition"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-0.5 mt-5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg transition capitalize whitespace-nowrap ${
                  tab === t
                    ? "bg-white/8 text-white border border-white/10 border-b-0"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Conflict banner */}
        {conflictError && (
          <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div>
              <p className="text-yellow-300 text-sm font-medium">
                ⚠️ Version conflict
              </p>
              <p className="text-yellow-400/70 text-xs mt-0.5">
                {conflictError.message}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  dispatch(getTasks(projectId));
                  dispatch(clearConflictError());
                }}
                className="px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 rounded-lg text-xs hover:bg-yellow-500/30 transition"
              >
                Refresh
              </button>
              <button
                onClick={() => dispatch(clearConflictError())}
                className="text-yellow-500 text-xs hover:text-yellow-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* TASKS */}
        {tab === "tasks" && (
          <div>
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Real-time sync enabled
                </p>
              </div>
              <button
                onClick={openCreate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg font-medium transition"
              >
                + New Task
              </button>
            </div>

            {taskError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-4">
                {taskError?.message}
              </div>
            )}

            {/* Task Form */}
            {showForm && (
              <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 mb-6 shadow-2xl">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-white font-semibold">
                    {editingTask ? "Edit task" : "Create task"}
                  </h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-gray-500 hover:text-white text-xl"
                  >
                    ×
                  </button>
                </div>
                <form
                  onSubmit={handleTaskSubmit}
                  className="grid grid-cols-1 md:grid-cols-2 gap-5"
                >
                  <div className="md:col-span-2">
                    <label className={labelCls}>Title *</label>
                    <input
                      name="title"
                      value={form.title}
                      onChange={handleFormChange}
                      placeholder="e.g. Train ML model"
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Description *</label>
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleFormChange}
                      rows={2}
                      placeholder="What does this task do?"
                      className={inputCls + " resize-none"}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Priority (1 low → 5 critical)
                    </label>
                    <div className="flex gap-2 mt-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            setForm((p) => ({ ...p, priority: n }))
                          }
                          className={`flex-1 py-2 rounded-lg text-sm font-bold transition border ${form.priority === n ? "bg-indigo-600 border-indigo-500 text-white" : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Estimated Hours</label>
                    <input
                      type="number"
                      name="estimatedHours"
                      min={0.1}
                      step={0.5}
                      value={form.estimatedHours}
                      onChange={handleFormChange}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Resource Tag{" "}
                      <span className="text-gray-600 normal-case">
                        (prevents parallel conflicts)
                      </span>
                    </label>
                    <input
                      name="resourceTag"
                      value={form.resourceTag}
                      onChange={handleFormChange}
                      placeholder="e.g. GPU, DB, API"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Max Retries</label>
                    <input
                      type="number"
                      name="maxRetries"
                      min={0}
                      max={10}
                      value={form.maxRetries}
                      onChange={handleFormChange}
                      className={inputCls}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>
                      Dependencies
                      {form.dependencies.length > 0 && (
                        <span className="ml-2 text-indigo-400 normal-case">
                          {form.dependencies.length} selected
                        </span>
                      )}
                    </label>
                    {/* ★ FIXED: custom checkbox list — no value binding issues */}
                    <DepSelector
                      allTasks={tasks}
                      excludeId={editingTask?._id}
                      selected={form.dependencies}
                      onChange={handleDepsChange}
                    />
                  </div>
                  {formError && (
                    <p className="md:col-span-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2">
                      {formError}
                    </p>
                  )}
                  <div className="md:col-span-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={taskLoading}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition"
                    >
                      {taskLoading
                        ? "Saving..."
                        : editingTask
                          ? "Update task"
                          : "Create task"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-6 py-2 border border-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {taskLoading && !showForm && (
              <div className="flex items-center justify-center py-20 text-gray-600">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-3" />
                Loading tasks...
              </div>
            )}

            {!taskLoading && !tasks.length && !showForm && (
              <div className="text-center py-24 text-gray-600">
                <p className="text-5xl mb-4">📝</p>
                <p className="text-gray-400 font-medium">No tasks yet</p>
                <p className="text-sm mt-1">
                  Create your first task to start orchestrating
                </p>
                <button
                  onClick={openCreate}
                  className="mt-4 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition"
                >
                  Create task
                </button>
              </div>
            )}

            {/* DAG view */}
            {tasks.length > 0 &&
              tasks.some((t) => t.dependencies?.length > 0) && (
                <div className="mb-6 bg-white/3 border border-white/8 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">
                    Dependency Graph
                  </p>
                  <DagView tasks={tasks} />
                </div>
              )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <TaskCard
                  key={task._id}
                  task={task}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          </div>
        )}

        {/* EXECUTION */}
        {tab === "execution" && (
          <div className="max-w-3xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Execution Plan
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Parallel-aware topological sort using Kahn's algorithm
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleComputeExecution}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg font-medium transition"
                >
                  {actionLoading ? "Computing..." : "▶ Compute"}
                </button>
                {executionPlan && (
                  <button
                    onClick={() => dispatch(clearExecutionPlan())}
                    className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded-lg text-xs transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {executionPlan ? (
              <ExecutionSteps
                steps={executionPlan.steps}
                blockedTasks={executionPlan.blockedTasks}
              />
            ) : (
              <div className="text-center py-20 text-gray-600 border border-white/5 rounded-2xl">
                <p className="text-4xl mb-3">⚙️</p>
                <p className="text-sm text-gray-400">
                  Click "Compute" to generate execution plan
                </p>
                <p className="text-xs mt-1 text-gray-600">
                  Tasks that can run in parallel will be grouped in the same
                  step
                </p>
              </div>
            )}
          </div>
        )}

        {/* SIMULATION */}
        {tab === "simulation" && (
          <div className="max-w-4xl space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white">
                Simulation Engine
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Interactive terminal + visual results
              </p>
            </div>

            {/* Terminal */}
            <Terminal projectId={projectId} tasks={tasks} />

            {/* Form fallback */}
            <div className="bg-white/5 border border-white/8 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-4">
                Quick Simulate
              </p>
              <form
                onSubmit={handleSimulate}
                className="flex flex-wrap gap-3 items-end"
              >
                <div>
                  <label className={labelCls}>Available Hours</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={simForm.availableHours}
                    onChange={(e) =>
                      setSimForm((p) => ({
                        ...p,
                        availableHours: e.target.value,
                      }))
                    }
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-indigo-500 transition w-32"
                  />
                </div>
                <div className="flex-1 min-w-40">
                  <label className={labelCls}>
                    Failed Task IDs (comma-sep, optional)
                  </label>
                  <input
                    value={simForm.failedTaskIds}
                    placeholder="id1, id2..."
                    onChange={(e) =>
                      setSimForm((p) => ({
                        ...p,
                        failedTaskIds: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-indigo-500 transition placeholder-gray-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition"
                >
                  {actionLoading ? "Running..." : "▶ Run"}
                </button>
                {simulationResult && (
                  <button
                    type="button"
                    onClick={() => dispatch(clearSimulation())}
                    className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white rounded-lg text-sm transition"
                  >
                    Clear
                  </button>
                )}
              </form>
            </div>

            {/* Results */}
            {simulationResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      l: "Hours Available",
                      v: simulationResult.availableHours,
                      c: "text-gray-300",
                    },
                    {
                      l: "Hours Used",
                      v: simulationResult.hoursUsed,
                      c: "text-green-400",
                    },
                    {
                      l: "Selected",
                      v: simulationResult.selectedTasks?.length,
                      c: "text-indigo-400",
                    },
                    {
                      l: "Priority Score",
                      v: simulationResult.totalPriorityScore,
                      c: "text-violet-400",
                    },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className="bg-white/5 border border-white/8 rounded-xl p-3 text-center"
                    >
                      <p className="text-xs text-gray-500">{s.l}</p>
                      <p className={`text-2xl font-bold mt-1 ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>

                <ExecutionSteps
                  steps={simulationResult.steps}
                  blockedTasks={simulationResult.blockedTasks}
                />

                {simulationResult.skippedTasks?.length > 0 && (
                  <div className="bg-gray-500/5 border border-white/8 rounded-xl p-4">
                    <p className="text-xs text-gray-500 uppercase font-medium mb-2">
                      ⏭ Skipped — no time (
                      {simulationResult.skippedTasks.length})
                    </p>
                    <div className="space-y-1">
                      {simulationResult.skippedTasks.map((t) => (
                        <div
                          key={t._id}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-gray-400">{t.title}</span>
                          <span className="text-gray-600">
                            {t.estimatedHours}h
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* MEMBERS */}
        {tab === "members" && (
          <div className="max-w-xl">
            <h2 className="text-base font-semibold text-white mb-4">
              Team Members
            </h2>
            <div className="bg-white/5 border border-white/8 rounded-xl overflow-hidden divide-y divide-white/5">
              <div className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-300 font-bold">
                  {currentProject?.owner?.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {currentProject?.owner?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {currentProject?.owner?.email}
                  </p>
                </div>
                <span className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
                  Owner
                </span>
              </div>
              {currentProject?.members?.map((m) => (
                <div key={m.user?._id} className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold">
                    {m.user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {m.user?.name}
                    </p>
                    <p className="text-xs text-gray-500">{m.user?.email}</p>
                  </div>
                  <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full capitalize">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" &&
          (isOwner ? (
            <div className="max-w-xl space-y-6">
              <div className="bg-white/5 border border-white/8 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-1">
                  Webhook
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Fires on task completion, retried up to 3× automatically
                </p>
                <form onSubmit={handleWebhookSave} className="flex gap-3">
                  <input
                    type="url"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    placeholder="https://your-webhook.example.com/hook"
                    className={inputCls + " flex-1"}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition"
                  >
                    Save
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-600 text-sm">
              Only the project owner can manage settings.
            </div>
          ))}
      </div>
    </div>
  );
};

export default ProjectDetails;
