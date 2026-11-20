/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useId, useState } from 'react';
import { Icon } from './icons.js';
import { Points, type Point } from './points.js';

/** Open state and the id that ties a Why button to its region. */
export function useWhy() {
  const id = useId();
  const [open, setOpen] = useState(false);
  return { id, open, toggle: () => setOpen((o) => !o) };
}

type Why = ReturnType<typeof useWhy>;

/** The "Why?" pill: a real button that says whether its explanation is open. */
export function WhyButton({ why, label }: { why: Why; label: string }) {
  return (
    <button
      type="button"
      className="v2-why"
      aria-expanded={why.open}
      aria-controls={why.id}
      onClick={why.toggle}
    >
      {label}
      <span className="v2-chev">
        <Icon name="chevronDown" size={12} />
      </span>
    </button>
  );
}

/** The explanation the button opens; always in the page, hidden while closed, so the button's target exists. */
export function WhyPanel({ why, points, well }: { why: Why; points: Point[]; well?: boolean }) {
  return (
    <div id={why.id} hidden={!why.open} className="v2-open">
      <Points points={points} well={well} />
    </div>
  );
}

/** Button and explanation together, for a claim whose explanation sits right under it. */
export function WhyToggle({ label, points }: { label: string; points: Point[] }) {
  const why = useWhy();
  return (
    <>
      <div>
        <WhyButton why={why} label={label} />
      </div>
      <WhyPanel why={why} points={points} />
    </>
  );
}
