import { ChartCard } from '../../../ui/v2/chart-card.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { HeatMatrix } from '../../../ui/v2/domain/heat-matrix.js';
import { PrintedDataTable } from '../../../ui/v2/domain/printed-table.js';
import { DrillAction, Section } from '../../../ui/v2/drill-action.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import { EmptyState } from '../../../ui/v2/screen-states.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import type { ShiftModel, ShiftSection } from './model.js';

/** Tiles in rows of two to four, so a section's figures stand in even rows. */
const columnsFor = (n: number): 2 | 3 | 4 => (n <= 2 ? 2 : n === 3 || n === 6 ? 3 : 4);

function SectionView({
  section,
  takeaway,
  words,
  selected,
}: {
  section: ShiftSection;
  takeaway: TakeawayData | null;
  words: ShiftModel['words'];
  selected: string | undefined;
}) {
  return (
    <Section
      title={section.title}
      action={section.drill ? <DrillAction drill={section.drill} /> : undefined}
    >
      {takeaway ? <Takeaway data={takeaway} /> : null}
      {section.notComputed ? <EmptyState text={words.notComputed} /> : null}
      {section.figures.length > 0 ? (
        <Row cols={columnsFor(section.figures.length)}>
          {section.figures.map((figure) => (
            <FigureTile key={figure.id} figure={figure} />
          ))}
        </Row>
      ) : null}
      {section.charts.length > 0 ? (
        <Row cols={2}>
          {section.charts.map((chart) => (
            <ChartCard key={chart.id} spec={chart.spec} sub={chart.sub} aria={chart.aria} />
          ))}
        </Row>
      ) : null}
      {section.tables.map((table, at) => (
        <PrintedDataTable
          key={`${table.title}-${at}`}
          table={table}
          words={words.table}
          selected={selected}
        />
      ))}
      {section.heat.map((matrix) => (
        <HeatMatrix key={matrix.id} matrix={matrix} words={words.heat} />
      ))}
    </Section>
  );
}

/**
 * Shift-calendar KPIs: the answer first, then the engine's four figures one under another (the two bases side by
 * side, the shift split, the backlog by working-hour age, the breakdown map with its Pareto charts and heat grids). A
 * machine or a cell in a table or a grid is a chip that opens its detail; a count or a section action opens the
 * tickets behind it in the drawer.
 */
export function ShiftKpisView({
  model,
  nav,
  title,
}: {
  model: ShiftModel;
  nav: NavItem[];
  title: string;
}) {
  const { current } = useEntityParam();
  const selected = current?.kind === 'machine' ? current.id : undefined;
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      {model.sections.map((section) => (
        <SectionView
          key={section.id}
          section={section}
          takeaway={model.takeaways[section.id] ?? null}
          words={model.words}
          selected={selected}
        />
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
