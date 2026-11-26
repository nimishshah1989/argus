import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons.js';

/** What a notice is about: a failure, a thing to watch, plain news, a success, a quiet state, or the lost connection. */
export type NoticeTone = 'error' | 'attention' | 'info' | 'ok' | 'muted' | 'offline';

const ICON: Record<NoticeTone, IconName> = {
  error: 'alert',
  attention: 'alert',
  info: 'inbox',
  ok: 'check',
  muted: 'clock',
  offline: 'pause',
};

/**
 * A message about the screen or a step (v1's message banner on the kit): an icon, a title, an optional line under it
 * and one action. An error is announced at once (role alert), the rest politely (role status). Unlike `Banner` it is
 * not a way in to another page.
 */
export function Notice({
  tone,
  title,
  icon,
  action,
  children,
}: {
  tone: NoticeTone;
  title: string;
  icon?: IconName;
  /** One button, such as Dismiss or Try again. */
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className="v2-notice" data-tone={tone}>
      <span className="v2-notice-icon">
        <Icon name={icon ?? ICON[tone]} size={16} />
      </span>
      <div className="v2-notice-body">
        <p className="v2-h3">{title}</p>
        {children ? <div className="v2-sub">{children}</div> : null}
        {action ? <div className="v2-notice-action">{action}</div> : null}
      </div>
    </div>
  );
}
