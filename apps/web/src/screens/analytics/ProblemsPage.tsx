import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyTable } from './key-body.js';
import type { PageTable } from './page-content.js';

/** The unplaced card: its last engine column is the key's bare `Accept` cell, so the screen names it. */
function isUnplaced(table: PageTable): boolean {
  return table.header[0] === 'Date' && table.header[4] === 'Group';
}

/** The group editor's card: the key's own columns, the first of which is the platform's order cell. */
function isEditor(table: PageTable): boolean {
  return table.header[0] === 'Order' && table.header[1] === 'Group name';
}

/**
 * "Entries the system could not place": the key's own rows and group cell, printed as they came. The engine's
 * last header is empty (the platform printed no header for the Accept column), so the screen labels it; the cells
 * stay the figure's, and no suggestion control is invented (R4).
 */
function UnplacedCard({ table }: { table: PageTable }) {
  const { t } = useTranslation();
  const header = table.header.map((cell, index) =>
    index === table.header.length - 1 && cell.trim() === '' ? t('analytics.problems.accept') : cell,
  );
  return <KeyTable table={{ ...table, header }} fits />;
}

/**
 * The plant's problem groups, read-only (R4): the key's order arrows, keywords and remove cell are printed as
 * the figure sent them, with no input, no reorder and no delete. The settings write and its audit are the
 * follow-up recorded in DEBT; until then the screen never pretends to edit.
 */
function GroupEditor({ table }: { table: PageTable }) {
  const { t } = useTranslation();
  const headingId = useId();
  const title = t('analytics.problems.editorTitle');
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="text-body font-semibold">
        {title}
      </h3>
      <p className="text-footnote text-neutral-600">{t('analytics.problems.editorReadOnly')}</p>
      <KeyTable table={{ ...table, title, sortable: false }} fits heading={false} />
    </section>
  );
}

/**
 * A10 Problem Analysis (41e-2) on the key screen: the four page KPIs, the four what-if KPIs, the two charts (the
 * Pareto bar and the group bubble), the five data tables and the read-only group editor. The five data tables sort in
 * the key table; the unplaced card and the editor are the screen's own cards because the platform's cells need a
 * header and a read-only frame.
 */
export function problemTable(table: PageTable): ReactNode {
  return isUnplaced(table) ? (
    <UnplacedCard table={table} />
  ) : isEditor(table) ? (
    <GroupEditor table={table} />
  ) : undefined;
}
