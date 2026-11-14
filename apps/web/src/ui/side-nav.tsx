import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { IconComponent } from './icon.js';

export interface NavItem {
  to: string;
  label: string;
  icon: IconComponent;
  /** A red count, e.g. open breakdowns. Hidden when 0. */
  badge?: number;
}
export interface NavGroup {
  /** A heading such as Settings or Admin; translated. */
  title?: string;
  items: NavItem[];
}

function Group({ title, items, current }: NavGroup & { current: string }) {
  const headingId = useId();
  return (
    <div className="flex flex-col gap-1">
      {title ? (
        <p id={headingId} className="px-3 pb-1 text-caption font-semibold text-neutral-600">
          {title}
        </p>
      ) : null}
      <ul aria-labelledby={title ? headingId : undefined} className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, badge }) => (
          <li key={to}>
            <Link
              to={to}
              // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
              aria-current={to === current ? 'page' : undefined}
              className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-footnote font-medium text-neutral-900 aria-[current=page]:bg-accent-tint aria-[current=page]:font-semibold aria-[current=page]:text-accent-text"
            >
              <Icon aria-hidden size={20} />
              {label}
              {badge ? (
                <span className="ml-auto min-w-5 rounded-full bg-danger-ink px-1 text-center text-caption font-bold text-surface">
                  {badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The desktop left menu (from 1024 px), where phones have the tab bar: grouped links, the current one marked. */
export function SideNav({
  label,
  groups,
  current,
}: {
  label: string;
  groups: NavGroup[];
  current: string;
}) {
  return (
    <nav
      aria-label={label}
      className="flex w-58 shrink-0 flex-col gap-4 rounded-2xl bg-surface px-3 py-4 shadow-card"
    >
      {groups.map((group, index) => (
        <Group key={group.title ?? index} {...group} current={current} />
      ))}
    </nav>
  );
}
