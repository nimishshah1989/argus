/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import type { ReactNode } from 'react';
import { Icon } from '../icons.js';
import { useTick } from '../motion.js';

/** A titled part of a drawer: a small label over its content. */
export function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="v2-detail-section">
      <h3 className="v2-detail-label">{label}</h3>
      {children}
    </section>
  );
}

/** A figure in a drawer: small label, the value at KPI size ticking in, an optional note. */
export function DetailFigure({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  const tick = useTick(value, 600);
  return (
    <div>
      <div className="v2-sub">{label}</div>
      <div className="v2-kpi-value">{tick.text}</div>
      {note ? <div className="v2-sub">{note}</div> : null}
    </div>
  );
}

/** Where the figures came from and how fresh they are, at the foot of a drawer or a card. */
export function SourceLine({ text }: { text: string }) {
  return (
    <p className="v2-source">
      <Icon name="clock" size={12} />
      {text}
    </p>
  );
}
