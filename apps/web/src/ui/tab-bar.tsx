import { Link } from 'react-router-dom';
import type { IconComponent } from './icon.js';

export interface TabItem {
  to: string;
  label: string;
  icon: IconComponent;
  /** A count shown on the icon, e.g. open breakdowns. Hidden when 0. */
  badge?: number;
}

/** The bottom tab bar: two tabs on the floor, five on the desk. The current tab is marked for screen readers. */
export function TabBar({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: TabItem[];
  current: string;
}) {
  return (
    <nav
      aria-label={label}
      className="sticky bottom-0 z-10 flex border-t border-neutral-200 bg-surface"
    >
      {tabs.map(({ to, label: tabLabel, icon: Icon, badge }) => (
        <Link
          key={to}
          to={to}
          // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
          aria-current={to === current ? 'page' : undefined}
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-caption font-semibold text-neutral-600 aria-[current=page]:text-accent-text"
        >
          <span className="relative">
            <Icon aria-hidden size={22} />
            {badge ? (
              <span className="absolute -top-2 -right-3 min-w-5 rounded-full bg-danger-ink px-1 text-center text-caption font-bold text-surface">
                {badge}
              </span>
            ) : null}
          </span>
          {tabLabel}
        </Link>
      ))}
    </nav>
  );
}
