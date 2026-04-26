/**
 * 🔧 EXECUTION ENGINE - THE HEART OF THE SYSTEM
 *
 * This is where the magic happens.
 * All logic for DAG, sorting, planning, simulation lives here.
 *
 * RULES:
 * 1. No database calls - pure functions only
 * 2. No side effects
 * 3. 100% testable
 * 4. Beginner friendly comments
 */

/**
 * ✅ Kahn's Algorithm for Topological Sort
 *
 * This is THE standard algorithm for DAG execution order.
 * Every workflow engine on the planet uses this.
 *
 * Sort order WITHIN same step:
 *  1. Highest PRIORITY first
 *  2. Lowest ESTIMATED HOURS first (shortest job first)
 */
class ExecutionService {
  // Kahn's Algorithm — returns parallel STEPS (tasks that can run concurrently)
  static computeExecutionPlan(tasks) {
    const taskMap = new Map(tasks.map((t) => [t._id.toString(), t]));
    const inDegree = new Map();
    const adjacency = new Map();

    for (const task of tasks) {
      inDegree.set(task._id.toString(), 0);
      adjacency.set(task._id.toString(), []);
    }

    for (const task of tasks) {
      for (const depId of task.dependencies || []) {
        const dep = depId.toString();
        if (adjacency.has(dep)) {
          adjacency.get(dep).push(task._id.toString());
          inDegree.set(
            task._id.toString(),
            (inDegree.get(task._id.toString()) || 0) + 1,
          );
        }
      }
    }

    const plan = [];
    let queue = [...inDegree.entries()]
      .filter(([, d]) => d === 0)
      .map(([id]) => id);

    const sortFn = (a, b) => {
      const ta = taskMap.get(a),
        tb = taskMap.get(b);
      if (tb.priority !== ta.priority) return tb.priority - ta.priority;
      if (ta.estimatedHours !== tb.estimatedHours)
        return ta.estimatedHours - tb.estimatedHours;
      return new Date(ta.createdAt) - new Date(tb.createdAt);
    };

    let stepNum = 1;
    while (queue.length > 0) {
      queue.sort(sortFn);
      const levelTasks = queue.map((id) => taskMap.get(id));
      plan.push({
        step: stepNum++,
        parallel: levelTasks.length > 1,
        tasks: levelTasks,
      });

      const nextQueue = [];
      for (const taskId of queue) {
        for (const neighbor of adjacency.get(taskId) || []) {
          inDegree.set(neighbor, inDegree.get(neighbor) - 1);
          if (inDegree.get(neighbor) === 0) nextQueue.push(neighbor);
        }
      }
      queue = nextQueue;
    }

    return plan;
  }

  // Simulation: given hours budget, returns what runs, what's blocked, what's skipped
  static simulate(tasks, availableHours, extraFailedIds = []) {
    const failedSet = new Set(extraFailedIds.map((id) => id.toString()));
    const taskMap = new Map(tasks.map((t) => [t._id.toString(), t]));
    const log = [];

    const isBlockedByFailed = (task, visited = new Set()) => {
      if (visited.has(task._id.toString())) return false;
      visited.add(task._id.toString());
      for (const depId of task.dependencies || []) {
        const dep = taskMap.get(depId.toString());
        if (!dep) continue;
        if (failedSet.has(dep._id.toString()) || dep.status === "Failed")
          return true;
        if (isBlockedByFailed(dep, visited)) return true;
      }
      return false;
    };

    const eligible = tasks.filter((t) => {
      if (t.status === "Completed") return false;
      if (
        t.status === "Blocked" ||
        t.status === "Failed" ||
        failedSet.has(t._id.toString())
      )
        return false;
      if (isBlockedByFailed(t)) return false;
      return true;
    });

    const blocked = tasks.filter(
      (t) =>
        t.status === "Blocked" ||
        t.status === "Failed" ||
        failedSet.has(t._id.toString()) ||
        isBlockedByFailed(t),
    );

    const plan = this.computeExecutionPlan(eligible);
    const selected = [],
      skipped = [];
    let hoursUsed = 0;

    log.push(`[ENGINE] EsMagico Orchestrator v2.0`);
    log.push(`[CONFIG] Available hours: ${availableHours}h`);
    log.push(
      `[CONFIG] Total tasks: ${tasks.length} | Eligible: ${eligible.length} | Blocked: ${blocked.length}`,
    );
    log.push(`─────────────────────────────────────`);

    for (const step of plan) {
      log.push(``);
      log.push(
        `[STEP ${step.step}] ${step.parallel ? `⚡ PARALLEL (${step.tasks.length} tasks)` : "▶ SEQUENTIAL"}`,
      );

      for (const task of step.tasks) {
        const fits = hoursUsed + task.estimatedHours <= availableHours;
        if (fits) {
          log.push(
            `   ✅ ${task.title.padEnd(28)} P${task.priority}  ${task.estimatedHours}h  [SCHEDULED]`,
          );
          hoursUsed += task.estimatedHours;
          selected.push(task);
        } else {
          log.push(
            `   ⏭  ${task.title.padEnd(28)} P${task.priority}  ${task.estimatedHours}h  [NO TIME]`,
          );
          skipped.push(task);
        }
      }
    }

    for (const task of blocked) {
      log.push(
        `   ❌ ${task.title.padEnd(28)}                [${task.status.toUpperCase()}]`,
      );
    }

    const totalPriorityScore = selected.reduce((s, t) => s + t.priority, 0);
    log.push(``);
    log.push(`─────────────────────────────────────`);
    log.push(
      `[RESULT] Hours used: ${hoursUsed.toFixed(1)}h / ${availableHours}h`,
    );
    log.push(
      `[RESULT] Scheduled: ${selected.length} | Blocked: ${blocked.length} | Skipped: ${skipped.length}`,
    );
    log.push(`[RESULT] Priority score: ${totalPriorityScore}`);
    log.push(`[ENGINE] Simulation complete ✓`);

    return {
      log,
      plan,
      selected,
      blocked,
      skipped,
      hoursUsed,
      totalPriorityScore,
    };
  }
}

module.exports = ExecutionService;
