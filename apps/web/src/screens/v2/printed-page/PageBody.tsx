import { Fragment, type ReactElement, type ReactNode } from 'react';
import { ChartCard } from '../../../ui/v2/chart-card.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { PrintedDataTable, type PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import type { PrintedPageModel } from './page-model.js';

/** Tiles in rows of three or four, so six figures stand in two even rows. */
const columnsFor = (n: number): 3 | 4 => (n === 3 || n === 6 ? 3 : 4);

/**
 * A screen built on one of the engine's printed pages: the verdict, the engine's figures, its charts two to a row and
 * its tables whole, each with search, sort and ten rows a page. A machine, a cell or a person in a table is a chip
 * that opens its detail in the drawer, which lives in the URL. `after` is whatever the screen adds below the tables.
 */
export function PageBody({
  model,
  nav,
  title,
  after,
  around,
}: {
  model: PrintedPageModel;
  nav: NavItem[];
  title: string;
  after?: ReactNode;
  /** A screen's own frame for one table (Manpower's Specialization toggle); it is handed the table as drawn. */
  around?: (table: PrintedTable, drawn: ReactElement) => ReactElement;
}) {
  const { current } = useEntityParam();
  const selected = current?.kind === 'machine' ? current.id : undefined;
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      {model.drill ? (
        <div>
          <DrillAction drill={model.drill} />
        </div>
      ) : null}
      {model.figures.length > 0 ? (
        <Row cols={columnsFor(model.figures.length)}>
          {model.figures.map((figure) => (
            <FigureTile key={figure.id} figure={figure} />
          ))}
        </Row>
      ) : null}
      {model.charts.length > 0 ? (
        <Row cols={2}>
          {model.charts.map((chart) => (
            <ChartCard key={chart.id} spec={chart.spec} sub={chart.sub} aria={chart.aria} />
          ))}
        </Row>
      ) : null}
      {model.tables.map((table, at) => {
        const drawn = (
          <PrintedDataTable table={table} words={model.words.table} selected={selected} />
        );
        return (
          <Fragment key={`${table.title}-${at}`}>{around ? around(table, drawn) : drawn}</Fragment>
        );
      })}
      {after}
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
