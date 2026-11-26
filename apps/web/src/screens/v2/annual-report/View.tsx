import { createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fill } from '../../../i18n/fill.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { PrintedDataTable, type PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import { sectionOf } from './adapter.js';
import type { AnnualReportModel } from './model.js';
import {
  type Bar,
  Bars,
  MonthsChart,
  MachinesChart,
  worstFirst,
  HOURS,
  ageBars,
  pmBars,
  LongestMark,
  AddedStrip,
} from './charts.js';

/** Five columns and five rows are the default; the rest opens in place (wireframe S24). */
const DEFAULT = 5;

/** Every column and every row of the table, under "Show the numbers". */
function Numbers({ table, selected }: { table: PrintedTable; selected: string | undefined }) {
  const { t } = useTranslation();
  const { model } = useModel();
  return (
    <ShowDetail label={t('kit.chart.table')}>
      <PrintedDataTable
        table={{ ...table, title: '' }}
        words={model.words.table}
        selected={selected}
      />
    </ShowDetail>
  );
}
const COMMENTARY = 'commentary';

/** One engine table: five columns and five rows to start with (worst first), the whole table opening under it. */
function Section({
  id,
  table,
  selected,
  lead,
}: {
  id: string;
  table: PrintedTable;
  selected: string | undefined;
  lead?: ReactNode;
}) {
  const { model } = useModel();
  const shown = id === 'months' || id === 'quarters' ? worstFirst(table, HOURS) : table;
  const compact: PrintedTable = {
    ...shown,
    header: shown.header.slice(0, DEFAULT),
    rows: shown.rows.slice(0, DEFAULT).map((row) => row.slice(0, DEFAULT)),
  };
  const takeaway = model.takeaways[id];
  return (
    <div data-section={id}>
      {takeaway ? <Takeaway data={takeaway} /> : null}
      {lead}
      <PrintedDataTable table={compact} words={model.words.table} selected={selected} />
      {table.rows.length > DEFAULT || table.header.length > DEFAULT ? (
        <Numbers table={table} selected={selected} />
      ) : null}
    </div>
  );
}

/** A section drawn as bars, its takeaway above and the whole table under "Show the numbers". */
function BarsSection({
  id,
  table,
  selected,
  bars,
}: {
  id: string;
  table: PrintedTable;
  selected: string | undefined;
  bars: Bar[];
}) {
  const { model } = useModel();
  const takeaway = model.takeaways[id];
  return (
    <div data-section={id}>
      {takeaway ? <Takeaway data={takeaway} /> : null}
      <SectionHead title={table.title} />
      <section className="v2-card" aria-label={table.title}>
        <Bars rows={bars} label={table.title} />
      </section>
      <Numbers table={table} selected={selected} />
    </div>
  );
}

function AddedSection({ table, selected }: { table: PrintedTable; selected: string | undefined }) {
  const { model } = useModel();
  const takeaway = model.takeaways.added;
  return (
    <div data-section="added">
      {takeaway ? <Takeaway data={takeaway} /> : null}
      <SectionHead title={table.title} />
      <AddedStrip table={table} />
      <Numbers table={table} selected={selected} />
    </div>
  );
}

/** The model, for the pieces below the View (one page, one model). */
const ModelContext = createContext<{ model: AnnualReportModel } | null>(null);
function useModel(): { model: AnnualReportModel } {
  const value = useContext(ModelContext);
  if (!value) throw new Error('AnnualReportView: no model');
  return value;
}

/** One engine table in its drawn form: bars (age, PM), the cell strip (added) or the ranked table. */
function TableSection({ table, selected }: { table: PrintedTable; selected: string | undefined }) {
  const { t } = useTranslation();
  const id = sectionOf(table.title, table.header[0]?.label) || COMMENTARY;
  if (id === 'added') return <AddedSection table={table} selected={selected} />;
  if (id === 'age')
    return <BarsSection id={id} table={table} selected={selected} bars={ageBars(table, t)} />;
  if (id === 'pm') {
    const part = fill(t('annual-report.part'), { n: 1, total: 2 });
    const titled = { ...table, title: `${table.title} (${part})` };
    return <BarsSection id={id} table={titled} selected={selected} bars={pmBars(table, t)} />;
  }
  const lead = id === 'long' ? <LongestMark table={table} /> : null;
  return <Section id={id} table={table} selected={selected} lead={lead} />;
}

/**
 * The Annual Report as drawn in wireframe S24 (#765): the lede, the period and the two downloads; the months as bars in
 * calendar order with the partial month starred and the worst month marked; the fifteen costliest machines as five bars
 * and a tail with the running share of the year; then every engine table worst first under its takeaway, with age and
 * PM as bars, the machines added as a cell strip, and each table whole under "Show the numbers". Every section sits in
 * an element with `data-section` set to its id: `months-chart`, `machines-chart`, the ids in `SECTIONS`, `commentary`.
 */
export function AnnualReportView({
  model,
  nav,
  title,
}: {
  model: AnnualReportModel;
  nav: NavItem[];
  title: string;
}) {
  const { current } = useEntityParam();
  const selected = current?.kind === 'machine' ? current.id : undefined;
  const [months, machines] = model.charts;
  return (
    <ModelContext.Provider value={{ model }}>
      <EntityShell nav={nav} title={title}>
        <Verdict verdict={model.verdict} whyLabel={model.words.why} />
        <div className="v2-row v2-gap-6">
          <p className="v2-sub">{model.period}</p>
          {model.links.map((link) => (
            <a key={link.href} className="v2-link" href={link.href}>
              {link.label}
            </a>
          ))}
          {model.drill ? <DrillAction drill={model.drill} /> : null}
        </div>
        {months ? <MonthsChart chart={months} /> : null}
        {machines ? <MachinesChart chart={machines} /> : null}
        {model.tables.map((table, at) => (
          <TableSection key={`${table.title}-${at}`} table={table} selected={selected} />
        ))}
        <SourceLine text={model.source} />
      </EntityShell>
    </ModelContext.Provider>
  );
}
