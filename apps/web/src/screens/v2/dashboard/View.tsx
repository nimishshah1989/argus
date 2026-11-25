/* eslint-disable i18next/no-literal-string -- icon names, typed unions; every visible word comes from the model */
import { useTranslation } from 'react-i18next';
import { ActionStrips } from '../../../ui/v2/action-strip.js';
import { Banner } from '../../../ui/v2/banner.js';
import { ChartCard } from '../../../ui/v2/chart-card.js';
import { LinkButton } from '../../../ui/v2/button.js';
import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DrillButton } from '../../../ui/v2/drill-button.js';
import { MoreToggle } from '../../../ui/v2/more-toggle.js';
import { Panel } from '../../../ui/v2/panel.js';
import { Segs } from '../../../ui/v2/points.js';
import { RankedBars } from '../../../ui/v2/ranked-bars.js';
import { SectionHead } from '../../../ui/v2/section-head.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import { TileSet } from '../../../ui/v2/tile-set.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { WhyToggle } from '../../../ui/v2/why-toggle.js';
import { EntityShell } from '../entity/EntityShell.js';
import { numberIn } from '../figures/read.js';
import { Bubble } from './BubbleChart.js';
import type { CostliestModel, DashboardModel, NeedsModel, WarningModel } from './model.js';
import { costliestRows } from './sweep.js';

/** What needs a person now: the table of tickets, or the plain line that nothing does, or that it could not be read. */
function Needs({ needs }: { needs: NeedsModel }) {
  if (needs.state === 'unavailable')
    return (
      <Panel title={needs.title}>
        <p role="status">{needs.text}</p>
      </Panel>
    );
  if (needs.table) return <EngineTable table={needs.table} />;
  return (
    <Panel title={needs.title} sub={needs.counts}>
      <p>{needs.empty}</p>
    </Panel>
  );
}

function Costliest({ costliest }: { costliest: CostliestModel }) {
  const { t } = useTranslation();
  const aside = (
    <>
      {costliest.drill ? <DrillButton drill={costliest.drill} /> : null}
      <LinkButton href={costliest.link.href}>{costliest.link.label}</LinkButton>
    </>
  );
  if (costliest.table)
    return (
      <Panel title={costliest.title} sub={costliest.sub} aside={aside}>
        <RankedBars rows={costliestRows(costliest, t)} label={costliest.title} />
      </Panel>
    );
  return (
    <Panel title={costliest.title} sub={costliest.sub} aside={aside}>
      <p>{costliest.empty}</p>
    </Panel>
  );
}

function Warning({ warning }: { warning: WarningModel }) {
  return (
    <Panel title={warning.title} sub={warning.sub}>
      <p className="v2-lede">
        <Segs point={warning.headline} />
      </p>
      {warning.more ? (
        <MoreToggle label={warning.more.label}>
          <p className="v2-lede">
            <Segs point={warning.more.rest} />
          </p>
        </MoreToggle>
      ) : null}
      <WhyToggle label={warning.whyLabel} points={warning.why} />
    </Panel>
  );
}

/** The Action Center's counts and the way in, urgent when any nudge is high priority; nothing when no nudge is open. */
export function ActionCenter({ note }: { note: DashboardModel['actionCenter'] }) {
  if (!note) return null;
  return (
    <Banner
      tone={note.tone}
      icon="decision"
      {...(note.tag ? { tag: note.tag } : {})}
      title={note.title}
      href={note.href}
      action={note.open}
    >
      {note.text}
    </Banner>
  );
}

/** A group of cards under its heading; the lead card of the hero group keeps its `hero` mark. */
function Cards({ section }: { section: DashboardModel['sections'][number] }) {
  return (
    <section className="v2-stack v2-gap-12" aria-label={section.title}>
      <SectionHead title={section.title} sub={section.sub} />
      <TileSet items={section.kpis.map((kpi) => ({ kpi, n: numberIn(kpi.value) ?? Number.NaN }))} />
    </section>
  );
}

/**
 * The page under the header, top to bottom: the answer, the two banners, the headline figures with the lead one big,
 * what needs you, where the time goes, the machine data, the problems, the pictures.
 */
function Body({ model }: { model: DashboardModel }) {
  const [headline, ...rest] = model.sections;
  return (
    <>
      <Verdict verdict={model.verdict} whyLabel={model.words.why} />
      <ActionStrips strips={model.strips} />
      {headline ? <Cards section={headline} /> : null}
      <Needs needs={model.needs} />
      {rest.length > 0 ? (
        <ShowDetail>
          {rest.map((section) => (
            <Cards key={section.id} section={section} />
          ))}
        </ShowDetail>
      ) : null}
      {model.costliest ? <Costliest costliest={model.costliest} /> : null}
      {model.warning ? <Warning warning={model.warning} /> : null}
      {model.charts.map((chart) =>
        'spec' in chart ? (
          <ChartCard
            key={chart.id}
            spec={chart.spec}
            sub={chart.sub}
            aria={chart.aria}
            drill={chart.drill}
            numbers
          />
        ) : 'bubble' in chart ? (
          <Bubble
            key={chart.id}
            title={chart.title}
            sub={chart.sub}
            aria={chart.aria}
            bubble={chart.bubble}
            drill={chart.drill}
          />
        ) : (
          <Panel key={chart.id} title={chart.title}>
            <p role="status">{chart.note}</p>
          </Panel>
        ),
      )}
      {model.machines ? <EngineTable table={model.machines} /> : null}
      <SourceLine text={model.source} />
    </>
  );
}

/**
 * The Dashboard: the answer first, what needs a person now with the ticket behind each item, every figure v1 printed
 * with what it covers, its change against 30 days earlier and the rows behind it, the problems that cost the most, the
 * machines the engine says are failing faster, and the two pictures with the machines they are drawn from. A machine,
 * a cell or a person opens in the drawer, which lives in the URL.
 */
export function DashboardView({
  model,
  nav,
  title,
}: {
  model: DashboardModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <EntityShell nav={nav} title={title}>
      <Body model={model} />
    </EntityShell>
  );
}
