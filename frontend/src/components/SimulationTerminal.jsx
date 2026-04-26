import React, { useState, useRef, useEffect } from "react";

/**
 * 💻 SIMULATION TERMINAL
 * 
 * Looks and behaves exactly like a developer console.
 * Accepts CLI style commands.
 * Shows animated output.
 * 
 * Commands:
 * > simulate 8
 * > plan
 * > help
 */
function SimulationTerminal({ projectId }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const terminalRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);

  const executeCommand = async (cmd) => {
    const parts = cmd.trim().split(' ');
    const command = parts[0].toLowerCase();

    if (command === 'simulate') {
      const hours = parseInt(parts[1]) || 8;
      setRunning(true);
      
      addLine(`$ ${cmd}`);
      addLine('');

      const res = await fetch(`/api/tasks/${projectId}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableHours: hours })
      });

      const data = await res.json();
      
      // Animate output line by line
      for (const line of data.data.log) {
        await new Promise(r => setTimeout(r, 200));
        addLine(line);
      }

      setRunning(false);
      return;
    }

    if (command === 'help') {
      addLine(`$ help`);
      addLine('');
      addLine('Available commands:');
      addLine('  simulate N   Run simulation for N hours');
      addLine('  plan         Show execution plan');
      addLine('  clear        Clear terminal');
      return;
    }

    addLine(`$ ${cmd}`);
    addLine(`Unknown command. Type help for options.`);
  };

  const addLine = (text) => {
    setHistory(prev => [...prev, text]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || running) return;
    executeCommand(input);
    setInput('');
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h2 className="text-lg font-bold mb-4">💻 System Terminal</h2>

      {/* TERMINAL WINDOW */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-400 text-sm ml-2">esm@engine:~</span>
        </div>

        {/* OUTPUT AREA */}
        <div 
          ref={terminalRef}
          className="p-4 h-72 overflow-auto font-mono text-sm"
          style={{ lineHeight: '1.7' }}
        >
          {history.map((line, i) => (
            <div key={i} className="text-green-300">{line || '\u00A0'}</div>
          ))}
        </div>

        {/* INPUT LINE */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700 flex gap-2">
          <span className="text-green-400 font-mono">$</span>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={running}
            placeholder="Type 'simulate 8' to run..."
            className="flex-1 bg-transparent text-green-300 outline-none font-mono"
            autoComplete="off"
          />
        </form>
      </div>
    </div>
  );
}

export default SimulationTerminal;