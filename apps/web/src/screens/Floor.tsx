import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

interface Machine {
  id: string;
  code: string;
  category: string | null;
  cell: string | null;
}
interface Config {
  machines: Machine[];
}

export function Floor() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState('');
  const [problem, setProblem] = useState('');
  const [ref, setRef] = useState('');

  useEffect(() => {
    api<Config>('/api/v1/config')
      .then((cfg) => setMachines(cfg.machines))
      .catch(() => undefined);
  }, []);

  async function report(event: React.FormEvent) {
    event.preventDefault();
    const body = await api<{ ref: string }>('/api/v1/tickets', {
      method: 'POST',
      body: JSON.stringify({ machineId, problem, kind: 'stopped' }),
    });
    setRef(body.ref);
    setProblem('');
  }

  return (
    <main>
      <div className="tabs">
        <Link to="/floor">Report</Link>
        <Link to="/desk">Open</Link>
      </div>
      <h1>Report a breakdown</h1>
      <form onSubmit={report}>
        <select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
          <option value="">Which machine?</option>
          {machines.map((machine) => (
            <option key={machine.id} value={machine.id}>
              {machine.code}
            </option>
          ))}
        </select>
        <textarea
          placeholder="What is wrong?"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
        />
        <button className="primary" type="submit" disabled={!machineId || !problem}>
          Send
        </button>
      </form>
      {ref && <div className="card">Sent to maintenance — {ref}</div>}
    </main>
  );
}
