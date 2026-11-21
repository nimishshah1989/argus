/* eslint-disable i18next/no-literal-string -- typed unions only; every visible word comes in as a prop */
import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons.js';

/** How loud a banner is: `loss` when something is urgent, `risk` to watch, `plan` for what is planned, `neutral` otherwise. */
export type BannerTone = 'loss' | 'risk' | 'plan' | 'neutral';

/**
 * A line across the page that says one thing needs a look and where to go: an icon, a tag in the tone's colour that
 * says it in words, the sentence, and the way in. The whole banner is the target; colour is never the only signal.
 */
export function Banner({
  tone,
  icon,
  tag,
  title,
  href,
  action,
  children,
}: {
  tone: BannerTone;
  icon: IconName;
  /** The tone in words ("High priority"); shown beside the icon so the colour never stands alone. */
  tag?: string;
  title: string;
  href: string;
  /** The link's own words ("Open Action Center"). */
  action: string;
  children: ReactNode;
}) {
  return (
    <section className="v2-card v2-banner" data-tone={tone} aria-label={title}>
      <span className="v2-banner-icon">
        <Icon name={icon} size={16} />
      </span>
      <div className="v2-banner-body">
        <div className="v2-banner-head">
          <h2 className="v2-h3">{title}</h2>
          {tag ? <span className={`v2-pill v2-pill-${tone}`}>{tag}</span> : null}
        </div>
        <p className="v2-banner-text">{children}</p>
      </div>
      <a className="v2-ref v2-banner-go" href={href}>
        {action}
        <Icon name="chevronRight" size={12} />
      </a>
    </section>
  );
}
