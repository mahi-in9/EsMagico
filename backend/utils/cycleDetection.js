/**
 * Detects if adding `newDeps` to task `taskId` creates a cycle
 * in the dependency graph formed by `allTasks`.
 *
 * Uses iterative DFS to avoid stack overflow on deep graphs.
 *
 * @param {string} taskId - the task being updated
 * @param {string[]} newDeps - proposed new dependency IDs
 * @param {Array} allTasks - all tasks in the project [{_id, dependencies}]
 * @returns {boolean} true if a cycle exists
 */
const hasCycle = (taskId, newDeps, allTasks) => {
  // Build adjacency: task -> its dependencies
  const graph = {};
  for (const t of allTasks) {
    const id = t._id.toString();
    graph[id] = (t.dependencies || []).map((d) => d.toString());
  }
  // Override for the task being updated
  graph[taskId.toString()] = newDeps.map((d) => d.toString());

  // Self-dependency check
  if (newDeps.map((d) => d.toString()).includes(taskId.toString())) return true;

  // DFS from taskId following dependency edges
  // A cycle exists if we can reach taskId starting from any of its deps
  const visited = new Set();
  const stack = [...(graph[taskId.toString()] || [])];

  while (stack.length) {
    const current = stack.pop();
    if (current === taskId.toString()) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const deps = graph[current] || [];
    stack.push(...deps);
  }

  return false;
};

module.exports = { hasCycle };
