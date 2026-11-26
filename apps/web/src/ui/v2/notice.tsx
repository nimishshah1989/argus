/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop */
import type { ReactNode } from 'react';
import type { BannerTone } from './banner.js';
import { Icon, type IconName } from './icons.js';

/**
 * A banner's look for a line that goes nowhere: an icon, the title and a sentence, and an optional button (Update).
 * A `loss` is announced at once (role alert); the rest politely (role status). The icon is never the only signal.
 */
export function Notice({
  tone,
  icon,
  title,
  action,
  children,
}: {
  tone: BannerTone;
  /** Default: a warning for a loss or a risk, a bell otherwise. */
  icon?: IconName;
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    // No aria-label: an error that names a field ("current password") must not label a second control.
    <section
      className="v2-card v2-banner"
      data-tone={tone}
      role={tone === 'loss' ? 'alert' : 'status'}
    >
      <span className="v2-banner-icon">
        <Icon name={icon ?? (tone === 'loss' || tone === 'risk' ? 'alert' : 'bell')} size={16} />
      </span>
      <div className="v2-banner-body">
        <h2 className="v2-h3">{title}</h2>
        {children ? <p className="v2-banner-text">{children}</p> : null}
      </div>
      {action}
    </section>
  );
}

/** The refusal of the last attempt, in the server's words; nothing while there is none. */
export function ErrorNotice({ error }: { error: string }) {
  return error ? <Notice tone="loss" title={error} /> : null;
}
