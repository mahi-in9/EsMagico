import React, { useState } from "react";

/**
 * 📋 EXECUTION PLAN VIEW
 * 
 * Shows exactly what order tasks will run in.
 * Clearly marks parallel execution steps.
 */
function ExecutionPlan({ projectId }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadPlan = async () => {
    setLoading(true);
    const res = await fetch(`/api/tasks/${projectId}/plan`);
    const data = await res.json();
    setPlan(data.data);
    setLoading(false);
  };

  if (!plan) {
    return (
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-bold mb-4">📋 Execution Plan</h2>
        <button 
          onClick={loadPlan}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md"
        >
          {loading ? 'Loading...' : 'Compute Execution Plan'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h2 className="text-lg font-bold mb-4">📋 Execution Plan</h2>
      
      <div className="space-y-3">
        {plan.steps.map(step => (
          <div key={step.step} className="border rounded-lg p-4">
            <div className="font-bold mb-2">
              Step {step.step} → {step.tasks.length} tasks (parallel)
            </div>
            <div className="flex flex-wrap gap-2">
              {step.tasks.map(task => (
                <div 
                  key={task._id}
                  className="bg-blue-100 px-3 py-1 rounded text-sm flex items-center gap-2"
                >
                  <span className="font-medium">{task.title}</span>
                  <span className="text-gray-500">P{task.priority}</span>
                  <span className="text-gray-500">{task.estimatedHours}h</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button 
        onClick={() => setPlan(null)}
        className="mt-4 text-sm text-gray-500"
      >
        Reset
      </button>
    </div>
  );
}

export default ExecutionPlan;