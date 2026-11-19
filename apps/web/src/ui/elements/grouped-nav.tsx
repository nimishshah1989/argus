import { Link } from 'react-router-dom';
import type { IconComponent } from '../icon.js';
import { WRAP } from './tone.js';

export interface NavItem {
  to: string;
  label: string;
  icon?: IconComponent;
}

export interface NavGroup {
  id: string;
  heading: string;
  items: NavItem[];
}

/** Screens under their headings. The current screen is marked for screen readers and shown by a tint and a bar. */
export function GroupedNav({
  label,
  groups,
  current,
  headingLevel = 3,
}: {
  label: string;
  groups: NavGroup[];
  current: string;
  /** The heading level of the group names: one below the heading the menu sits under. */
  headingLevel?: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col gap-4">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`nav-${group.id}`} className="flex flex-col gap-1">
          <Heading
            id={`nav-${group.id}`}
            className={`px-3 text-caption font-bold tracking-wide text-neutral-600 uppercase ${WRAP}`}
          >
            {group.heading}
          </Heading>
          <ul className="flex flex-col">
            {group.items.map(({ to, label: itemLabel, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
                  aria-current={to === current ? 'page' : undefined}
                  className="flex min-h-target-min items-center gap-3 rounded-xl border-l-4 border-transparent px-3 text-body text-neutral-900 aria-[current=page]:border-accent-strong aria-[current=page]:bg-accent-tint aria-[current=page]:font-semibold aria-[current=page]:text-accent-text"
                >
                  {Icon ? <Icon aria-hidden size={20} className="shrink-0" /> : null}
                  <span className={WRAP}>{itemLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
