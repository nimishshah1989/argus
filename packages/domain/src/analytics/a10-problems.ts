import { availableHours, availabilityWindow } from './availability.js';
import { formatInr, formatNumber, formatPercent, normalizeLabel } from './format.js';
import { isProduction } from './machine-facts.js';
import { dmy } from './plant-date.js';
import { analyzeProblems, type ProblemAnalysis, type ProblemEvent } from './problem-analysis.js';
import { OTHER_PROBLEM, PROBLEM_GROUPS, type ProblemGroup } from './problem-groups.js';
import {
  predict,
  problemTraining,
  type ProblemTraining,
  type ProblemSuggestion,
} from './problem-suggest.js';
import { isHistory, sourcedReports } from './rows.js';
import type { Computer, EngineData, FigureValue } from './types.js';

/**
 * A10, the Problem Analysis page (ticket 41, packet 41d-2): the platform's own page whole — the eight KPIs (the
 * four page figures and the four "what if we cut a problem?" figures), the six tables and the two charts. The
 * grouping, families, repeats and words come from 41d-1's core; the unplaced card's suggestions come from
 * `problem-suggest.ts`; the editor prints the plant's own group list (the key's own rendered cells).
 *
 * The what-if reads the top group at 50% and the production fleet's available hours from 1 January of the data year
 * to the run date — each machine from its purchase date, as the platform's `availSum` does.
 */

/** The platform prints the top 15 repeat pairs and the first 16 bars, and slices the action cell to 110 chars. */
const REPEAT_SHOWN = 15;
const PARETO_SHOWN = 16;
const ACTION_CHARS = 110;
/** The what-if slider's frozen position on this key. */
const WHAT_SHARE = 0.5;
/** The words table offers the plant's groups after its placeholder. */
const WORD_PLACEHOLDER = 'Choose group…';

/** The production fleet's available hours for the run's window: 1 January of the data year to the run date. */
function availableTotal(
  data: EngineData,
  asOf: string,
  profile: { prodHrsPerDay: number; workDaysPerYear: number },
): number {
  const latest = sourcedReports(data)
    .filter(isHistory)
    .map((row) => row.report.date)
    .sort()
    .at(-1);
  const window = availabilityWindow(asOf, latest ?? null);
  const annual = profile.prodHrsPerDay * profile.workDaysPerYear;
  return data.machines
    .filter(isProduction)
    .reduce((total, machine) => total + availableHours(machine, annual, window.from, window.to), 0);
}

/** The four page KPIs, in the platform's order and its own formats. */
function pageKpis(analysis: ProblemAnalysis) {
  const { totalCount, totalHours, groups, events } = analysis;
  const top = groups[0];
  if (top === undefined) return [];
  const quick = events.filter((event) => event.hours <= 0.5);
  const quickHours = quick.reduce((total, event) => total + event.hours, 0);
  const repeatHours = analysis.repeats.reduce((total, repeat) => total + repeat.hours, 0);
  return [
    {
      label: 'Breakdowns studied',
      value: String(totalCount),
      sub: `${formatInr(totalHours, 0)} hrs of downtime, PM excluded`,
    },
    {
      label: 'Top problem group',
      value: top.name.split(' / ')[0]!,
      sub: `${formatPercent(top.hours / totalHours)} of all hours`,
    },
    {
      label: 'Quick stops (30 min or less)',
      value: formatPercent(quick.length / totalCount),
      sub: `of breakdowns, but only ${formatPercent(quickHours / totalHours)} of hours`,
    },
    {
      label: 'Repeat problems',
      value: formatPercent(repeatHours / totalHours),
      sub: `${analysis.repeats.length} machine and problem pairs, 4+ times`,
    },
  ];
}

/** The four "what if we cut a problem?" KPIs: the top group cut in half against the fleet's available hours. */
function whatIfKpis(analysis: ProblemAnalysis, available: number) {
  const { totalCount, totalHours, groups } = analysis;
  const top = groups[0];
  if (top === undefined) return [];
  const savedHours = top.hours * WHAT_SHARE;
  const savedCount = top.count * WHAT_SHARE;
  const before = available > 0 ? 1 - totalHours / available : null;
  const after = available > 0 ? 1 - (totalHours - savedHours) / available : null;
  const mtbfBefore = available > 0 && totalCount > 0 ? (available - totalHours) / totalCount : null;
  const mtbfAfter =
    available > 0 && totalCount - savedCount > 0
      ? (available - (totalHours - savedHours)) / (totalCount - savedCount)
      : null;
  const whatIf = [
    {
      label: 'Downtime saved',
      value: `${formatInr(savedHours, 0)} hrs`,
      sub: `${formatPercent(savedHours / totalHours)} of all breakdown hours`,
    },
    {
      label: 'Breakdowns avoided',
      value: formatInr(savedCount, 0),
      sub: `out of ${totalCount} in the period`,
    },
  ];
  if (before !== null && after !== null) {
    whatIf.push({
      label: 'Plant availability',
      value: formatPercent(after),
      sub: `was ${formatPercent(before)} (+${((after - before) * 100).toFixed(2)} points)`,
    });
  }
  if (mtbfBefore !== null && mtbfAfter !== null) {
    whatIf.push({
      label: 'MTBF',
      value: `${formatInr(mtbfAfter, 0)} hrs`,
      sub: `was ${formatInr(mtbfBefore, 0)} hrs`,
    });
  }
  return whatIf;
}

/** The eight KPIs the page prints: the four page figures, then the four what-if figures. */
const kpis = (analysis: ProblemAnalysis, available: number) => [
  ...pageKpis(analysis),
  ...whatIfKpis(analysis, available),
];

/** "All problem groups": one row per group, most hours first, formatted as the platform prints it. */
function groupTable(analysis: ProblemAnalysis) {
  const rows = analysis.groups.map((group) => [
    group.name,
    group.family,
    String(group.count),
    formatPercent(group.count / analysis.totalCount),
    formatNumber(group.hours, 1),
    formatPercent(group.hours / analysis.totalHours),
    formatNumber(group.hours / group.count, 2),
    String(group.machineIds.length),
    formatPercent(group.quick / group.count),
  ]);
  return {
    title: 'All problem groups',
    header: [
      'Problem group',
      'Family',
      'Breakdowns',
      '% of breakdowns',
      'Hours',
      '% of hours',
      'Hrs each',
      'Machines',
      'Quick',
    ],
    rows,
    rowCount: rows.length,
  };
}

/** "Families of problems": the groups rolled up, with the groups inside in their encounter order. */
function familyTable(analysis: ProblemAnalysis) {
  const rows = analysis.families.map((family) => [
    family.name,
    String(family.count),
    formatPercent(family.count / analysis.totalCount),
    formatNumber(family.hours, 1),
    formatPercent(family.hours / analysis.totalHours),
    family.groups.join('; '),
  ]);
  return {
    title: 'Families of problems',
    header: ['Family', 'Breakdowns', '% of breakdowns', 'Hours', '% of hours', 'Groups inside'],
    rows,
    rowCount: rows.length,
  };
}

/** "Repeat offenders": the 15 largest machine-and-group pairs, hours first. */
function repeatTable(analysis: ProblemAnalysis) {
  const rows = analysis.repeats
    .slice(0, REPEAT_SHOWN)
    .map((repeat) => [
      repeat.machineCode,
      repeat.category,
      repeat.group,
      String(repeat.count),
      formatNumber(repeat.hours, 1),
    ]);
  return {
    title: 'Repeat offenders',
    header: ['Machine', 'Category', 'Problem group', 'Times', 'Hours'],
    rows,
    rowCount: rows.length,
  };
}

/** "Words not yet recognised": the shared words, with the platform's placeholder and group choices beside them. */
function wordTable(analysis: ProblemAnalysis, groups: readonly ProblemGroup[]) {
  const choices = groups.map((group) => group.name).join('');
  const rows = analysis.words.map((word) => [
    word.word,
    String(word.count),
    formatNumber(word.hours, 1),
    word.example,
    `${WORD_PLACEHOLDER}${choices}`,
  ]);
  return {
    title: 'Words not yet recognised',
    header: ['Word', 'In entries', 'Hours', 'Example problem', 'Add to group'],
    rows,
    rowCount: rows.length,
  };
}

/** One unplaced event with its suggestion, and the probability that decides the card's order (none is 0). */
interface UnplacedRow {
  readonly event: ProblemEvent;
  readonly suggestion: ProblemSuggestion | null;
}

/** The entries no keyword placed, strongest suggestion first; a suggestionless entry sorts last. */
function unplacedRows(analysis: ProblemAnalysis, training: ProblemTraining): UnplacedRow[] {
  const rows: UnplacedRow[] = [];
  for (const event of analysis.events) {
    if (event.group !== OTHER_PROBLEM) continue;
    const text = `${event.problem} ${event.correctiveAction}`;
    rows.push({
      event,
      suggestion: training.model === null ? null : predict(training.model, text),
    });
  }
  return rows.sort(
    (left, right) => (right.suggestion?.probability ?? 0) - (left.suggestion?.probability ?? 0),
  );
}

/** The select's text content: the suggestion line, then every group name with nothing between them. */
function groupCell(suggestion: ProblemSuggestion | null, groups: readonly ProblemGroup[]): string {
  const lead =
    suggestion === null
      ? 'No suggestion'
      : `Suggested: ${suggestion.label} (${Math.round(suggestion.probability * 100)}%)`;
  return lead + groups.map((group) => group.name).join('');
}

/**
 * "Entries the system could not place": the platform's suggestion card. The action is collapsed and then sliced to
 * 110 characters (the shared free-text rule); the title carries the count and its share of every studied entry.
 */
function unplacedTable(
  analysis: ProblemAnalysis,
  training: ProblemTraining,
  groups: readonly ProblemGroup[],
  data: EngineData,
) {
  const machines = new Map(data.machines.map((machine) => [machine.id, machine]));
  const rows = unplacedRows(analysis, training).map(({ event, suggestion }) => [
    dmy(event.date),
    machines.get(event.machineId)?.code ?? event.machineId,
    normalizeLabel(event.problem),
    normalizeLabel(event.correctiveAction).slice(0, ACTION_CHARS),
    groupCell(suggestion, groups),
    suggestion === null ? '' : 'Accept',
  ]);
  return {
    title: `Entries the system could not place (${rows.length}, ${formatPercent(rows.length / analysis.totalCount)} of all)`,
    header: ['Date', 'Machine', 'Problem', 'Action taken', 'Group', ''],
    rows,
    rowCount: rows.length,
  };
}

/**
 * The group editor's table: the key's own rendered cells. The platform prints input values not at all, so the name
 * and family cells are empty and the order cell is the two arrows; the screen renders the real editor (R4).
 */
function editorTable(groups: readonly ProblemGroup[]) {
  const rows = groups.map((group) => ['↑ ↓', '', '', group.keywords.join(', '), '×']);
  return {
    title: '',
    header: ['Order', 'Group name', 'Family', 'Keywords', ''],
    rows,
    rowCount: rows.length,
  };
}

/** "Which problems cost the most?": the 16 largest groups, with their share of all hours in the label. */
function paretoChart(analysis: ProblemAnalysis) {
  const rows = [...analysis.groups]
    .sort((left, right) => right.hours - left.hours)
    .slice(0, PARETO_SHOWN);
  return {
    id: 'ch-prob-pareto',
    type: 'bar',
    axes: { x: 'Breakdown hours', y: '' },
    tickLabels: { x: [], y: [] },
    labels: rows.map(
      (group) => `${group.name}  (${Math.round((100 * group.hours) / analysis.totalHours)}%)`,
    ),
    datasets: [{ label: '', data: rows.map((group) => Math.round(group.hours * 10) / 10) }],
  };
}

/** "Often, or long?": every group, x its count, y its average hours (2 dp), r the square root of its hours. */
function bubbleChart(analysis: ProblemAnalysis) {
  const rows = analysis.groups.filter((group) => group.count > 0);
  return {
    id: 'ch-prob-scatter',
    type: 'bubble',
    axes: { x: 'How often (number of breakdowns)', y: 'How long each one takes (average hrs)' },
    tickLabels: { x: [], y: [] },
    labels: [],
    datasets: [
      {
        label: '',
        data: rows.map((group) => ({
          x: group.count,
          y: Math.round((group.hours / group.count) * 100) / 100,
          r: Math.max(5, Math.min(26, Math.sqrt(group.hours) * 1.3)),
        })),
      },
    ],
  };
}

/** The plant's group list: its own edited list (R7), else the platform default. */
function groupListOf(data: EngineData): readonly ProblemGroup[] {
  const edited = data.settings?.problemGroups;
  return edited !== undefined && edited.length > 0 ? edited : PROBLEM_GROUPS;
}

/**
 * The A10 figure: the key's page whole. A plant with no production breakdown has no page to print, so the value is
 * null rather than a fabricated zero. The drill names every production breakdown ticket the analysis read.
 */
export const a10ProblemsFigure: Computer = ({ data, asOf, profile }) => {
  const analysis = analyzeProblems(data);
  if (analysis.totalCount === 0) return { value: null, drillIds: [] };
  const groups = groupListOf(data);
  const training = problemTraining(data);
  const value = {
    screen: 'a10-problems',
    asOf,
    pages: [
      {
        page: 'a10',
        title: 'Problem Analysis',
        kpis: kpis(analysis, availableTotal(data, asOf, profile)),
        tables: [
          groupTable(analysis),
          familyTable(analysis),
          repeatTable(analysis),
          unplacedTable(analysis, training, groups, data),
          wordTable(analysis, groups),
          editorTable(groups),
        ],
        charts: [paretoChart(analysis), bubbleChart(analysis)],
      },
    ],
  };
  return {
    value: value as unknown as FigureValue,
    drillIds: analysis.events.map((event) => event.ticketId),
  };
};
