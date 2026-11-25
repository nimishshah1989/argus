import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fill } from '../../i18n/fill.js';

/**
 * The data-trust marker (ADR 0036 R5, #698): a page whose figures skip held rows says how many, linking to the
 * review tray. `count` = rows held for review; `href` = the review tray's URL, used exactly as given.
 * - `count <= 0` → `null` (nothing rendered at all).
 * - `count === 1` → text `t('insight.review.row')`.
 * - `count > 1` → text `fill(t('insight.review.rows'), { n: count })` (`fill` from `../../i18n/fill.js`).
 * Markup: `<a className="v2-ref" data-status="watch" href={href}>{text}</a>`, nothing else (copy the `.v2-ref`
 * link in `kpi-card.tsx`, without its icon). Words via `useTranslation()` as in `table-parts.tsx`. No CSS of its own.
 */
export function ReviewMarker({ count, href }: { count: number; href: string }): ReactNode {
  const { t } = useTranslation();
  if (count <= 0) return null;
  const text = count === 1 ? t('insight.review.row') : fill(t('insight.review.rows'), { n: count });
  return (
    <a className="v2-ref" data-status="watch" href={href}>
      {text}
    </a>
  );
}
