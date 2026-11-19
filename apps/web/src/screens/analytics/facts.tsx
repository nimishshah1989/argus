import { useId, type ReactNode } from 'react';
import './register-parts.css';

export interface Fact {
  id: string;
  label: string;
  value: string;
  /** A quiet line under the value, for what is not the value (the basis, why it is missing). */
  note?: string | null;
}

/** One thing's facts: each a label over its value, as many to a row as fit. A missing fact is left out by the caller. */
export function Facts({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="rg-facts">
      {facts.map((fact) => (
        <div key={fact.id}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
          {fact.note ? <dd className="rg-fact-note">{fact.note}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** A named part of a page: its heading names the region, and its way to the rows sits on the heading's line. */
export function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rg-block">
      <div className="rg-block-head">
        <h3 id={headingId}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
