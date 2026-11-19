import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from '../icon.js';
import { WRAP } from './tone.js';

/**
 * A button that shows or hides one region ("Show details"): `aria-expanded` says which, the button is a 44 px
 * target and the region is named by it. The chevron turns and the region fades in, both off under reduced motion.
 */
export function Disclosure({
  label,
  children,
  defaultOpen = false,
}: {
  /** The button's words; the open state is said by `aria-expanded`, so the words stay the same. */
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        id={`${id}-button`}
        aria-expanded={open}
        aria-controls={`${id}-region`}
        onClick={() => setOpen(!open)}
        className="el-disclosure inline-flex min-h-target-min min-w-target-min items-center gap-2 self-start text-footnote font-semibold text-accent-text"
      >
        <ChevronDown aria-hidden size={16} className="el-chevron shrink-0" />
        <span className={WRAP}>{label}</span>
      </button>
      <div
        role="region"
        id={`${id}-region`}
        aria-labelledby={`${id}-button`}
        hidden={!open}
        className={`el-fade ${WRAP}`}
      >
        {children}
      </div>
    </div>
  );
}
