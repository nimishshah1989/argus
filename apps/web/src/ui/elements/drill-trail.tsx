import { Link } from 'react-router-dom';
import { ChevronRight } from '../icon.js';
import { WRAP } from './tone.js';

export interface TrailStep {
  label: string;
  /** Where the step goes back to; the last step is where you are and has none. */
  to?: string;
}

/** Where a drill-down came from: every step but the last is a link back; the last is the current page. */
export function DrillTrail({ label, steps }: { label: string; steps: TrailStep[] }) {
  if (steps.length === 0) return null;
  const last = steps.length - 1;
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-x-1">
        {steps.map((step, at) => (
          <li key={`${at}-${step.label}`} className="flex min-w-0 items-center gap-1">
            {at === last || !step.to ? (
              <span aria-current="page" className={`text-footnote font-semibold ${WRAP}`}>
                {step.label}
              </span>
            ) : (
              <Link
                to={step.to}
                className={`inline-flex min-h-target-min items-center text-footnote text-accent-text underline ${WRAP}`}
              >
                {step.label}
              </Link>
            )}
            {at < last ? (
              <ChevronRight aria-hidden size={16} className="shrink-0 text-neutral-600" />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
