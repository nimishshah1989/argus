import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../ui/card.js';
import { SegmentedBar } from '../../ui/segmented-bar.js';
import { KeyTable } from './key-body.js';
import type { PageTable } from './page-content.js';

/** The two forms of the Specialization card; the ids are not copy, so the catalogue test does not see them. */
const CATEGORY = 'category';
const CODE = 'code';
type View = typeof CATEGORY | typeof CODE;

/**
 * A4's Specialization card (41e-1): the key's category matrix behind a category/code toggle, as the platform has
 * it. The engine's figures reply carries only the category form and no maintenance-code matrix, so the code form
 * is the honest "Not computed yet" rather than a fabricated table or a dead pill. The whole-page key equality
 * (41a) is what makes that the only truthful reading until an engine packet ships `codesUsed`/`codeMatrix`.
 */
function SpecializationCard({ table }: { table: PageTable }) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>(CATEGORY);
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-body font-semibold">{table.title}</h3>
      <SegmentedBar
        label={t('analytics.specialization.toggle')}
        items={[
          { id: CATEGORY, label: t('analytics.specialization.category') },
          { id: CODE, label: t('analytics.specialization.code') },
        ]}
        selected={view}
        onSelect={(id) => setView(id === CODE ? CODE : CATEGORY)}
      />
      {view === CATEGORY ? (
        <KeyTable table={table} fits heading={false} />
      ) : (
        <Card>
          <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
        </Card>
      )}
    </section>
  );
}

/**
 * A4 manpower (41e-1) on the key screen: the three KPIs, the five tables, the chart and the drill all come from the
 * engine. Only the Specialization card is the screen's own, because it owns the platform's category/code toggle; the
 * mapper marks the Manpower table and the two month matrices sortable, and the key table draws them.
 */
export function manpowerTable(table: PageTable): ReactNode {
  return table.title === 'Specialization' ? <SpecializationCard table={table} /> : undefined;
}
