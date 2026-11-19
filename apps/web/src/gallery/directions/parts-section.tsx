import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DISPLAY_STYLE } from './direction-props.js';
import { AS_OF } from './figures.js';
import { addStrings } from './strings.js';

addStrings({ asOf: 'As of {{date}}, the plant’s snapshot' });

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** One titled block of a screen; its heading wears the direction's display type like the figures do. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-body font-semibold" style={DISPLAY_STYLE}>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The day the screen's figures were taken: the real screens would read today, this preview reads the answer key. */
export function AsOf() {
  const { t } = useTranslation('directions');
  return (
    <p className="text-footnote text-neutral-600">
      {t('asOf', { date: DATE.format(new Date(AS_OF)) })}
    </p>
  );
}
