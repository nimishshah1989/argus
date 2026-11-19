/* eslint-disable i18next/no-literal-string -- English-only dev fixtures with invented numbers (like elements-section); the heading goes through t() */
import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../ui/button.js';
import { Card } from '../ui/card.js';
import { Chart } from '../ui/chart/chart.js';
import { Select } from '../ui/input.js';
import { DataTable, Disclosure, KpiTile, StatusChip, type Column } from '../ui/elements/index.js';
import { TABLE_LABELS } from './elements-data.js';

interface Line {
  id: number;
  name: string;
  hours: number;
  note: string;
}
const LINES: Line[] = [
  { id: 1, name: 'Press 1', hours: 4.5, note: 'Planned' },
  { id: 2, name: 'Press 2', hours: 2, note: 'Done' },
];
const COLUMNS: Column<Line>[] = [
  { id: 'name', header: 'Machine', cell: (r) => r.name },
  { id: 'hours', header: 'Hours', cell: (r) => r.hours.toFixed(1), numeric: true },
  { id: 'note', header: 'Note', cell: (r) => r.note, align: 'center' },
];

/** The additions of ticket 83d, each in the state a screen asks for it; the gallery is their only user for now. */
export function ElementsGaps() {
  const { t } = useTranslation('gallery');
  return (
    <section
      data-testid="element-gaps"
      aria-label={t('elements.gaps')}
      className="flex flex-col gap-3"
    >
      <h3 className="text-body font-semibold">{t('elements.gaps')}</h3>
      <KpiTile label="Trend" value="Stable" />
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone="info">Planned</StatusChip>
        <Select aria-label="Period" fit defaultValue="week">
          <option value="week">This week</option>
          <option value="month">This month</option>
        </Select>
        <ButtonLink to="/gallery" variant="tonal">
          Open as a link
        </ButtonLink>
      </div>
      <Disclosure label="Show details">Hidden until the button is pressed.</Disclosure>
      <Card ariaLabel="Short list" padded={false}>
        <DataTable
          columns={COLUMNS}
          rows={LINES}
          rowKey={(r) => String(r.id)}
          total={LINES.length}
          page={0}
          pageSize={25}
          labels={{ ...TABLE_LABELS, caption: 'Short list' }}
          onSort={() => {}}
          onPage={() => {}}
          hidePagerWhenFits
        />
      </Card>
      <Chart
        spec={{
          kind: 'bar',
          title: 'Hours by cell',
          categoryLabel: 'Cell',
          valueLabel: 'Hours',
          categories: ['Cell 1', 'Cell 2'],
          series: [{ name: 'Hours', values: [6, 2] }],
          axisTitles: true,
        }}
      />
    </section>
  );
}
