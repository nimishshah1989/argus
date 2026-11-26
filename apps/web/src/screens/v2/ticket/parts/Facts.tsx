import type { TicketFact } from '../model.js';

/** One `dt` and exactly one `dd` per fact; a note prints after the `dd`, never as a second one. */
export function Facts({ rows }: { rows: TicketFact[] }) {
  return (
    <dl className="v2-facts">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="v2-sub">{row.label}</dt>
          <dd className="v2-fact-value">{row.value}</dd>
          {row.note ? <span className="v2-sub">{row.note}</span> : null}
        </div>
      ))}
    </dl>
  );
}
