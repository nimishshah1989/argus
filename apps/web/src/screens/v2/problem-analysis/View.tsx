/* eslint-disable i18next/no-literal-string -- the download's file name is not a visible word */
import { useTranslation } from 'react-i18next';
import { ChartNumbers } from '../../../ui/v2/chart-numbers.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DownloadExcel } from '../../../ui/v2/download-excel.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Quadrant } from '../../../ui/v2/quadrant.js';
import { RankedBars } from '../../../ui/v2/ranked-bars.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import type { Translate } from '../figures/read.js';
import { costRows, meanSplit, problemSheets, quadNames, quadPoints } from './sweep.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useEntityParam } from '../entity/url.js';
import { PrintedDataTable } from '../../../ui/v2/domain/printed-table.js';
import type { PrintedTable } from '../../../ui/v2/domain/printed-table.js';
import type { ProblemAnalysisModel, ProblemChart } from './model.js';

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
 * One engine chart as a kit card: ranked bars for the bar, a quadrant for the scatter. The card keeps the engine's
 * title as its `aria-label` and its own "Show the numbers" (the numbers tests find the card by that label).
 */
function ChartPiece({ chart, model }: { chart: ProblemChart; model: ProblemAnalysisModel }) {
  const { t } = useTranslation();
  const say: Translate = (key, values) => t(key, { ...values }) as string;
  const { spec } = chart;
  const points = spec.kind === 'scatter' ? quadPoints(spec) : [];
  return (
    <section className="v2-card v2-pad" aria-label={spec.title}>
      <div className="v2-card-head">
        <div>
          <h2 className="v2-h2">{spec.title}</h2>
          <p className="v2-sub">{chart.sub}</p>
        </div>
      </div>
      {spec.kind === 'bar' ? (
        <RankedBars rows={costRows(spec, model.groups, model.words.rest)} label={chart.aria} />
      ) : null}
      {spec.kind === 'scatter' ? (
        <Quadrant
          points={points}
          split={meanSplit(points)}
          names={quadNames(say)}
          axis={{ x: spec.xLabel, y: spec.yLabel }}
          aria={chart.aria}
        />
      ) : null}
      <ChartNumbers spec={spec} />
    </section>
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
      {model.whatIf.length > 0 ? (
        <ShowDetail label={model.words.whatIf}>
          <Row cols={4}>
            {model.whatIf.map((figure) => (
              <FigureTile key={figure.id} figure={figure} />
            ))}
          </Row>
        </ShowDetail>
      ) : null}
      <Row cols={2}>
        {model.charts.map((chart) => (
          <ChartPiece key={chart.id} chart={chart} model={model} />
        ))}
      </Row>
      <div>
        <DownloadExcel file="problem-analysis" sheets={problemSheets(model)} />
      </div>
      <Tables model={model} />
      <SourceLine text={model.source} />
    </EntityShell>
  );
}
