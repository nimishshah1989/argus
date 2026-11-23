/* eslint-disable i18next/no-literal-string -- icon names only; every visible word comes in as a prop */
import type { ReactNode } from 'react';
import { Icon } from './icons.js';
import { useWhy } from './why-toggle.js';

/** "and 18 more": a button that opens the rest of a list in place, so a short list never hides how long it is. */
export function MoreToggle({ label, children }: { label: string; children: ReactNode }) {
  const more = useWhy();
  return (
    <>
      <div>
        <button
          type="button"
          className="v2-why"
          aria-expanded={more.open}
          aria-controls={more.id}
          onClick={more.toggle}
        >
          {label}
          <span className="v2-chev">
            <Icon name="chevronDown" size={12} />
          </span>
        </button>
      </div>
      <div id={more.id} hidden={!more.open} className="v2-open">
        {children}
      </div>
    </>
  );
}
