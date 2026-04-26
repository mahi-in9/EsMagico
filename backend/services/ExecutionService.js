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

class ExecutionService {

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
  static computeExecutionPlan(tasks) {
    const inDegree = new Map();
    const adjacency = new Map();

    // Initialize graph
    for (const task of tasks) {
      inDegree.set(task._id.toString(), task.dependencies.length);
      adjacency.set(task._id.toString(), []);
    }

    // Build reverse graph: who depends on whom?
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        const depStr = depId.toString();
        if (adjacency.has(depStr)) {
          adjacency.get(depStr).push(task._id.toString());
        }
      }
    }

    const plan = [];
    let queue = [];

    // Step 1: Find all tasks with NO dependencies
    for (const [taskId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(taskId);
      }
    }

    while (queue.length > 0) {

      // 🔑 IMPORTANT: SORT BEFORE RUNNING!
      queue.sort((a, b) => {
        const ta = tasks.find(t => t._id.toString() === a);
        const tb = tasks.find(t => t._id.toString() === b);
        
        // First priority (descending)
        if (tb.priority !== ta.priority) return tb.priority - ta.priority;
        
        // Then shortest job first (ascending)
        return ta.estimatedHours - tb.estimatedHours;
      });

      const levelSize = queue.length;
      const stepTasks = [];

      for (let i = 0; i < levelSize; i++) {
        const taskId = queue.shift();
        const task = tasks.find(t => t._id.toString() === taskId);
        stepTasks.push(task);

        // Unlock all tasks that depend on this one
        for (const neighbor of adjacency.get(taskId)) {
          inDegree.set(neighbor, inDegree.get(neighbor) - 1);
          if (inDegree.get(neighbor) === 0) {
            queue.push(neighbor);
          }
        }
      }

      plan.push({
        step: plan.length + 1,
        parallel: true,
        tasks: stepTasks
      });
    }

    return plan;
  }

  /**
   * ⏱️ SIMULATION ENGINE
   * 
   * Given X available hours, tells you EXACTLY:
   * ✅ What will get completed
   * ❌ What is blocked
   * ⏭ What there is no time for
   */
  static simulate(tasks, availableHours) {
    const plan = this.computeExecutionPlan(tasks);
    const log = [];
    let hoursUsed = 0;
    
    const selected = [];
    const blocked = [];
    const skipped = [];

    log.push(`[ENGINE] Starting simulation`);
    log.push(`[CONFIG] Available hours: ${availableHours}`);
    log.push(`================================`);

    for (const step of plan) {
      log.push(``);
      log.push(`[STEP ${step.step}]`);

      for (const task of step.tasks) {

        if (task.status === 'Completed') {
          log.push(`   ✅ ${task.title} (already done)`);
          selected.push(task);
          continue;
        }

        if (task.status === 'Failed' || task.status === 'Blocked') {
          log.push(`   ❌ ${task.title} (${task.status})`);
          blocked.push(task);
          continue;
        }

        // Check if we have enough time left
        if (hoursUsed + task.estimatedHours > availableHours) {
          log.push(`   ⏭ ${task.title} (no time)`);
          skipped.push(task);
          continue;
        }

        // ✅ We have time - run it!
        log.push(`   ▶️ ${task.title} (${task.estimatedHours}h, P${task.priority})`);
        hoursUsed += task.estimatedHours;
        selected.push(task);
      }
    }

    log.push(``);
    log.push(`[RESULT] Simulation complete`);
    log.push(`   Completed: ${selected.length}`);
    log.push(`   Blocked: ${blocked.length}`);
    log.push(`   Skipped: ${skipped.length}`);
    log.push(`   Hours used: ${hoursUsed} / ${availableHours}`);

    const totalPriority = selected.reduce((sum, t) => sum + t.priority, 0);

    return {
      log,
      plan,
      selected,
      blocked,
      skipped,
      hoursUsed,
      totalPriorityScore: totalPriority
    };
  }
}

module.exports = ExecutionService;