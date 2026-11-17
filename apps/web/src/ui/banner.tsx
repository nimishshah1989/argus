import type { ReactNode } from 'react';
import { CircleCheck, Info, TimerOff, TriangleAlert, WifiOff, type IconComponent } from './icon.js';

export type BannerTone = 'offline' | 'info' | 'attention' | 'error' | 'muted' | 'ok';

const TONE: Record<BannerTone, { box: string; title: string; icon: IconComponent }> = {
  offline: { box: 'bg-muted-tint', title: 'text-neutral-900', icon: WifiOff },
  info: { box: 'rounded-xl bg-info-tint', title: 'text-info-ink', icon: Info },
  attention: { box: 'rounded-xl bg-warning-tint', title: 'text-warning-ink', icon: TriangleAlert },
  error: { box: 'rounded-xl bg-danger-tint', title: 'text-danger-ink', icon: TriangleAlert },
  muted: { box: 'rounded-xl bg-muted-tint', title: 'text-muted-ink', icon: TimerOff },
  ok: { box: 'rounded-xl bg-ok-tint', title: 'text-ok-ink', icon: CircleCheck },
};

/**
 * A message about the whole screen. Offline runs edge to edge under the top bar; the others sit in the gutter.
 * An error is announced at once (role alert); the rest politely (role status).
 */
export function Banner({
  tone,
  title,
  children,
  action,
  icon,
}: {
  tone: BannerTone;
  title: string;
  /** The line under the title. */
  children?: ReactNode;
  /** One button, e.g. Dismiss or Try again. */
  action?: ReactNode;
  /** A different icon for the tone (a refusal uses a cross, not a warning triangle). */
  icon?: IconComponent;
}) {
  const { box, title: titleInk, icon: toneIcon } = TONE[tone];
  const Icon = icon ?? toneIcon;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex flex-col gap-3 p-4 ${box}`}>
      <div className="flex gap-2">
        <Icon aria-hidden size={20} className={`mt-0.5 shrink-0 ${titleInk}`} />
        <div className="flex flex-col gap-1">
          <p className={`text-body font-bold ${titleInk}`}>{title}</p>
          {children ? <div className="text-footnote text-neutral-900">{children}</div> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
