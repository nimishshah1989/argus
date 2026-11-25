import type { ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * What a section keeps below the fold (ADR 0036 R1): a native, closed
 * `<details class="v2-show-detail"><summary>{label ?? t('insight.detail.show')}</summary>{children}</details>`.
 */
export function ShowDetail({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}): ReactElement {
  const { t } = useTranslation();
  return (
    <details className="v2-show-detail">
      <summary>{label ?? t('insight.detail.show')}</summary>
      {children}
    </details>
  );
}
