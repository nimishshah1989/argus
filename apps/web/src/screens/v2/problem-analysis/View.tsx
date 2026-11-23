import { ChartCard } from '../../../ui/v2/chart-card.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import { PrintedDataTable } from '../../../ui/v2/domain/printed-table.js';
import type { PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import type { ProblemAnalysisModel } from './model.js';

function Tables({ model }: { model: ProblemAnalysisModel }) {
  const { current } = useEntityParam();
  const selected = current?.kind === 'machine' ? current.id : undefined;
  const { words } = model;
  const show = (table: PrintedTable | null) =>
    table ? <PrintedDataTable table={table} words={words.table} selected={selected} /> : null;
  return (
    <>
      {show(model.groups)}
      {show(model.families)}
      {show(model.repeats)}
      {show(model.unplaced)}
      {show(model.unrecognised)}
      {model.editor ? (
        <Panel title={model.editor.title} sub={words.editorReadOnly} flush>
          <PrintedDataTable table={{ ...model.editor, title: '' }} words={words.table} />
        </Panel>
      ) : null}
    </>
  );
}

/**
 * Problem Analysis: the verdict, the engine's eight figures (the page's four, then what the top problem group would
 * win back), its two charts, and its six tables whole. A machine or a person in a table is a chip that opens its
 * detail in the drawer, which lives in the URL.
 */
export function ProblemAnalysisView({
  model,
  nav,
  title,
}: {
  model: ProblemAnalysisModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <EntityShell nav={nav} title={title}>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <Row cols={4}>
        {model.studied.map((figure) => (
          <FigureTile key={figure.id} figure={figure} />
        ))}
      </Row>
      <Panel title={model.words.whatIf}>
        <Row cols={4}>
          {model.whatIf.map((figure) => (
            <FigureTile key={figure.id} figure={figure} />
          ))}
        </Row>
      </Panel>
      <Row cols={2}>
        {model.charts.map((chart) => (
          <ChartCard key={chart.id} spec={chart.spec} sub={chart.sub} aria={chart.aria} numbers />
        ))}
      </Row>
      <Tables model={model} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
