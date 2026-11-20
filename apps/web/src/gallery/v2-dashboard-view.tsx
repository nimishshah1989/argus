import { useState } from 'react';
import { Dashboard } from '../screens/v2/dashboard/Dashboard.js';
import { dashboardFixture } from '../screens/v2/dashboard/fixture.js';

/**
 * The v2 Dashboard on its invented fixture: what Nimish approves here is what ships with the API behind it. This
 * view stands in for the server: it keeps which decisions are taken and hands them back in the model.
 */
export default function V2DashboardView() {
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set());
  const set = (id: string, on: boolean) =>
    setDecided((was) => {
      const next = new Set(was);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const model = {
    ...dashboardFixture,
    decisions: dashboardFixture.decisions.map((d) => ({ ...d, decided: decided.has(d.id) })),
  };
  return (
    <Dashboard model={model} onDecide={(id) => set(id, true)} onUndo={(id) => set(id, false)} />
  );
}
