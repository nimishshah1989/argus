import { useId, useState } from 'react';
import { ChevronDown } from '../icon.js';
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
      <ChevronDown className="v2-chev" size={12} strokeWidth={2.5} aria-hidden="true" />
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
