import type { ReactElement } from 'react';
import { ChartCard } from '../../../ui/v2/chart-card.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { PrintedDataTable } from '../../../ui/v2/domain/printed-table.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { MoneyMattersModel } from './model.js';

/** Tiles in rows of three or four, so six figures stand in two even rows (as PageBody sizes them). */
const columnsFor = (n: number): 3 | 4 => (n === 3 || n === 6 ? 3 : 4);

/** The takeaway id of each of the engine's tables, in its order: the levers table, then the lost table. */
const TABLE_SECTIONS = ['levers', 'lost'];

/** A section's takeaway, drawn only when the model has one for it: a null or absent line draws nothing. */
const lineOf = (data: TakeawayData | null | undefined) => (data ? <Takeaway data={data} /> : null);

/**
 * S22 Money Matters in the v2 look (wireframe design/wireframes/S22-money-matters.html): the refusal alone, or the
 * verdict, the three headings of tiles, the chart, the two tables, each section opening with its takeaway, the rows
 * behind and the source line.
 */
export function MoneyMattersView({
  model,
  nav,
  title,
}: {
  model: MoneyMattersModel;
  nav: NavItem[];
  title: string;
}): ReactElement {
  if (model.refused) {
    return (
      <EntityShell nav={nav} title={title}>
        <section role="alert" className="v2-card v2-pad">
          <SectionHead title={model.title} sub={model.body} />
        </section>
      </EntityShell>
    );
  }
  const { takeaways } = model;
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      {model.drill ? (
        <div>
          <DrillAction drill={model.drill} />
        </div>
      ) : null}
      {model.groups.map((group) => (
        <section key={group.id}>
          <SectionHead title={group.title} />
          <Row cols={columnsFor(group.figures.length)}>
            {group.figures.map((figure) => (
              <FigureTile key={figure.id} figure={figure} />
            ))}
          </Row>
        </section>
      ))}
      {model.chart ? (
        <section>
          {lineOf(takeaways?.chart)}
          <Row cols={2}>
            <ChartCard
              spec={model.chart.spec}
              sub={model.chart.sub}
              aria={model.chart.aria}
              numbers
            />
          </Row>
        </section>
      ) : null}
      {model.tables.map((table, at) => (
        <section key={table.title}>
          {lineOf(takeaways?.[TABLE_SECTIONS[at] ?? ''])}
          <PrintedDataTable table={table} words={model.words.table} />
        </section>
      ))}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
