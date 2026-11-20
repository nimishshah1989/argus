import { printed } from './a9-bottleneck.js';
import { formatNumber } from './format.js';
import { isProduction } from './machine-facts.js';
import { dmy } from './plant-date.js';
import { PW_STOP } from './problem-analysis.js';
import {
  OTHER_PROBLEM,
  PROBLEM_GROUPS,
  problemGroupOf,
  type ProblemGroup,
} from './problem-groups.js';
import { effectiveHours, isPm, sourcedReports, type SourcedReport } from './rows.js';
import type { Computer, EngineData, FigureValue, ReportRow } from './types.js';

/**
 * The Fix Finder (ticket 43, packet 43d): the platform's similarity search over the plant's own breakdown log,
 * whole against the frozen 11 November key. The key's capture typed "spindle overload" with no machine and no
 * category, so this figure ranks that phrase plant-wide and prints the platform's result: four KPIs and the
 * fifteen best of the fifty-seven similar cases. The search box is a later face packet.
 *
 * The score is Guide section 27's. The query's stems (synonym-expanded, typo-tolerant and rarity-weighted) are
 * matched against every production, non-PM breakdown's problem and corrective-action text: a problem hit counts in
 * full, an action-only hit at 60%, and an entry in the query's problem group gains 25%, capped at 100%. Entries
 * under 30% are dropped; the page keeps the best match and everything at at least 60% of it (never under 35%),
 * capped at 80. A NO-DT row is a real case and contributes 0 hours, as every figure reads it.
 */

/** The key's captured search phrase; the face's own search box is a later packet. */
export const FIX_FINDER_QUERY = 'spindle overload';

/** Filler words that say nothing about the fault: a match on one never earns a point. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  ...PW_STOP,
  ...'problem issue issues not working work fault trouble machine machines please need how fix fixed'.split(
    ' ',
  ),
]);

/** The platform's equivalent words, one group each; every word is matched through the same stem as the query. */
const SYNONYMS: readonly (readonly string[])[] = [
  ['stuck', 'jam', 'jammed', 'struck', 'stucked', 'lock', 'locked'],
  ['noise', 'noice', 'sound', 'vibration', 'vibrat'],
  ['leak', 'lekage', 'leakge', 'dripping', 'drip', 'seepage'],
  ['overload', 'ol', 'overcurrent', 'overheat', 'heating', 'hot'],
  ['alarm', 'alram', 'error', 'fault'],
  ['coolant', 'colant', 'coolnat', 'cooling'],
  ['clamp', 'unclamp', 'declamp', 'clamping'],
  ['atc', 'toolchange', 'changer'],
  ['broken', 'break', 'broke', 'damage', 'damaged', 'cracked'],
  ['accident', 'acceident', 'crash', 'collision'],
  ['geometry', 'geomatry', 'geometr'],
  ['power', 'voltage', 'supply', 'mains'],
  ['slow', 'sluggish'],
  ['stop', 'stopped', 'halt', 'shutdown'],
];

/** The platform's least relevance a hit may have and still print. */
const MIN_RELEVANCE = 0.3;
/** An action-only hit counts this much of a problem hit. */
const ACTION_WEIGHT = 0.6;
/** The page keeps a hit at this share of the best match, but never below 35%. */
const BEST_SHARE = 0.6;
const MIN_SHARE = 0.35;
/** The platform caps its evidence list at 80 cases and prints 15 rows. */
const EVIDENCE_LIMIT = 80;
const ROW_LIMIT = 15;
/** 12 or more similar cases is good evidence; 5 to 11 some; fewer is a hint. */
const GOOD_EVIDENCE = 12;
const SOME_EVIDENCE = 5;
/** A word of two characters can mean something; one letter or a bare number cannot. */
const MIN_WORD = 2;

/** The platform's stemmer: a long word loses a suffix; a short word loses a plural "s". */
function stemWord(word: string): string {
  if (word.length > 5) return word.replace(/(ing|ation|age|ed|es|ion|ly)$/, '');
  if (word.length > 3) return word.replace(/s$/, '');
  return word;
}

/** The words a text offers the index: lowercased, two characters or more, no bare numbers, no filler. */
function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_WORD && !/^[0-9]+$/.test(word) && !STOP_WORDS.has(word));
}

/** The stemmed words of one text as a set: the index counts each word once per entry. */
const stemSet = (text: string): Set<string> => new Set(tokensOf(text).map(stemWord));

/** The platform's bounded Levenshtein distance; a pair beyond the limit answers the limit plus one. */
function editDistance(left: string, right: string, limit: number): number {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current: number[] = [row];
    let smallest = row;
    for (let column = 1; column <= right.length; column += 1) {
      const distance = Math.min(
        previous[column]! + 1,
        current[column - 1]! + 1,
        previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      current[column] = distance;
      if (distance < smallest) smallest = distance;
    }
    if (smallest > limit) return limit + 1;
    previous = current;
  }
  return previous[right.length]!;
}

/** One breakdown as the search reads it, with the words it carries and the problem group it belongs to. */
interface FixCase {
  readonly ticketId: string;
  readonly machineId: string;
  /** The code the log prints for the machine; its id is the database's and is never printed. */
  readonly machineCode: string;
  readonly date: string;
  readonly problem: string;
  readonly action: string;
  readonly doneBy: string;
  readonly hours: number;
  readonly problemTokens: ReadonlySet<string>;
  readonly actionTokens: ReadonlySet<string>;
  readonly group: string;
}

/** The plant's whole searchable log: its cases, how often each stem occurs, and that vocabulary in log order. */
interface FixIndex {
  readonly cases: readonly FixCase[];
  readonly frequency: ReadonlyMap<string, number>;
  readonly vocabulary: readonly string[];
  readonly total: number;
}

/** One query word as the search scores it: its rarity weight and every stem that may answer it. */
interface FixTerm {
  readonly idf: number;
  readonly candidates: ReadonlySet<string>;
}

/** A scored case. */
interface FixHit {
  readonly entry: FixCase;
  readonly score: number;
}

/** The plant's problem-group list when it has edited one, else the platform default (R7); an empty list is no edit. */
function groupsOf(data: EngineData): readonly ProblemGroup[] {
  const edited = data.settings?.problemGroups;
  return edited !== undefined && edited.length > 0 ? edited : PROBLEM_GROUPS;
}

/** The query as a report row for the shared classifier, which reads only the id, the problem and the action. */
const QUERY_ROW = {
  id: '',
  problem: FIX_FINDER_QUERY,
  correctiveAction: '',
} as ReportRow;

/** One sourced row as a case: its ticket, text, effective hours and group (a manual fix wins inside the classifier). */
function caseOf(
  row: SourcedReport,
  groups: readonly ProblemGroup[],
  fixes: Readonly<Record<string, string>>,
  lookup: { names: ReadonlyMap<string, string>; codes: ReadonlyMap<string, string> },
): FixCase {
  const { report, ticket } = row;
  const { names, codes } = lookup;
  return {
    ticketId: ticket.id,
    machineId: report.machineId,
    machineCode: codes.get(report.machineId) ?? '',
    date: report.date,
    problem: report.problem,
    action: report.correctiveAction ?? '',
    doneBy: report.doneBy.map((code) => names.get(code) ?? code).join(', '),
    hours: effectiveHours(report),
    problemTokens: stemSet(report.problem),
    actionTokens: stemSet(report.correctiveAction ?? ''),
    group: problemGroupOf(report, fixes, groups),
  };
}

/** The searchable log: every production breakdown except PM, in log order, with its stem frequencies. */
function buildIndex(data: EngineData): FixIndex {
  const groups = groupsOf(data);
  const fixes = data.settings?.problemFixes ?? {};
  const production = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  const names = new Map(data.people.map((person) => [person.code, person.displayName]));
  const codes = new Map(data.machines.map((machine) => [machine.id, machine.code]));
  const cases: FixCase[] = [];
  const frequency = new Map<string, number>();
  for (const row of sourcedReports(data)) {
    if (!production.has(row.report.machineId) || isPm(row)) continue;
    const entry = caseOf(row, groups, fixes, { names, codes });
    cases.push(entry);
    for (const stem of new Set([...entry.problemTokens, ...entry.actionTokens])) {
      frequency.set(stem, (frequency.get(stem) ?? 0) + 1);
    }
  }
  return { cases, frequency, vocabulary: [...frequency.keys()], total: cases.length };
}

/** The stem group each synonym word belongs to, built once with the platform's own stem of every word. */
const SYNONYM_CLASS: ReadonlyMap<string, readonly string[]> = new Map(
  SYNONYMS.flatMap((group) => group.map((word) => [stemWord(word), group] as const)),
);

/** How many edits a query stem may tolerate: none at five letters or fewer, one to seven, two above. */
const typoLimit = (stem: string): number => (stem.length <= 5 ? 0 : stem.length <= 7 ? 1 : 2);

/** Whether one vocabulary word shares a long enough prefix with the query stem, the platform's first recovery. */
function sharesPrefix(stem: string, word: string): boolean {
  if (word.length < 5 || stem.length < 5) return false;
  return word.startsWith(stem) || stem.startsWith(word);
}

/** Whether a vocabulary word may answer the query stem: the same word, a shared prefix, or a tolerated typo. */
function mayAnswer(stem: string, word: string, limit: number): boolean {
  if (word === stem) return false;
  if (sharesPrefix(stem, word)) return true;
  return limit > 0 && word[0] === stem[0] && editDistance(stem, word, limit) <= limit;
}

/** The plant's stems that may answer one query stem: the word, its synonyms, the same prefix and its typos. */
function candidatesOf(stem: string, index: FixIndex): ReadonlySet<string> {
  const candidates = new Set<string>();
  if (index.frequency.has(stem)) candidates.add(stem);
  for (const word of SYNONYM_CLASS.get(stem) ?? []) {
    const synonym = stemWord(word);
    if (index.frequency.has(synonym)) candidates.add(synonym);
  }
  if (stem.length < 4) return candidates;
  const limit = typoLimit(stem);
  for (const word of index.vocabulary) {
    if (candidates.has(word)) continue;
    if (mayAnswer(stem, word, limit)) candidates.add(word);
  }
  return candidates;
}

/** One query word with its rarity weight: rarer words say more, and a word no case uses weighs nothing. */
function termOf(stem: string, index: FixIndex): FixTerm {
  const candidates = candidatesOf(stem, index);
  let frequency = 0;
  for (const candidate of candidates) frequency += index.frequency.get(candidate) ?? 0;
  const shared = frequency > 0 ? Math.min(frequency, index.total) : 0;
  const idf = shared > 0 ? Math.log(1 + index.total / Math.max(1, shared)) : 0;
  return { idf, candidates };
}

/** The query's distinct stems, in the order the words were typed. */
function termsOf(query: string, index: FixIndex): FixTerm[] {
  const terms: FixTerm[] = [];
  const seen = new Set<string>();
  for (const word of tokensOf(query)) {
    const stem = stemWord(word);
    if (seen.has(stem)) continue;
    seen.add(stem);
    terms.push(termOf(stem, index));
  }
  return terms;
}

/** Whether a case carries any of a term's candidate stems in one of its two texts. */
function carries(tokens: ReadonlySet<string>, candidates: ReadonlySet<string>): boolean {
  for (const candidate of candidates) if (tokens.has(candidate)) return true;
  return false;
}

/** One case's relevance: a problem hit in full, an action-only hit at 60%, then the query group's bonus. */
function relevanceOf(
  entry: FixCase,
  terms: readonly FixTerm[],
  idfSum: number,
  group: string | null,
): number {
  let matched = 0;
  for (const term of terms) {
    if (carries(entry.problemTokens, term.candidates)) matched += term.idf;
    else if (carries(entry.actionTokens, term.candidates)) matched += ACTION_WEIGHT * term.idf;
  }
  let relevance = idfSum > 0 ? matched / idfSum : 0;
  if (group !== null && entry.group === group) {
    relevance = Math.min(1, relevance + (terms.length > 0 ? 0.25 : 0.6));
  }
  return relevance;
}

/** Every case at 30% or more, best match first and then the most recent; a tie keeps log order. */
function hitsOf(index: FixIndex, terms: readonly FixTerm[], group: string | null): FixHit[] {
  const live = terms.filter((term) => term.idf > 0);
  if (live.length === 0 && group === null) return [];
  const idfSum = live.reduce((total, term) => total + term.idf, 0);
  return index.cases
    .map((entry) => ({ entry, score: relevanceOf(entry, live, idfSum, group) }))
    .filter((hit) => hit.score >= MIN_RELEVANCE)
    .sort(
      (left, right) => right.score - left.score || right.entry.date.localeCompare(left.entry.date),
    );
}

/** The evidence set the page counts and drills: the best match and at least 60% of it, never above 35%. */
function similarCases(hits: readonly FixHit[]): FixHit[] {
  const best = hits[0]?.score ?? 0;
  const threshold = Math.max(MIN_SHARE, BEST_SHARE * best);
  return hits.filter((hit) => hit.score >= threshold).slice(0, EVIDENCE_LIMIT);
}

/** The platform's hours text: the shortest decimal that names the value, then grouped and fixed. */
const hoursText = (value: number, decimals: number): string =>
  formatNumber(printed(value, decimals), decimals);

/** The median of the evidence hours, the platform's upper-middle rank when the count is even. */
function medianHours(cases: readonly FixHit[]): number {
  if (cases.length === 0) return 0;
  const hours = cases.map((hit) => hit.entry.hours).sort((left, right) => left - right);
  return hours[Math.floor(hours.length / 2)]!;
}

/** The evidence's confidence label, the Guide's 12/5 bands. */
function confidenceOf(count: number): string {
  if (count >= GOOD_EVIDENCE) return 'Good evidence';
  if (count >= SOME_EVIDENCE) return 'Some evidence';
  return 'Few similar cases — treat as a hint only';
}

/** The four KPIs. No machine was chosen on this key, so "On this machine" is the platform's dash. */
function kpisOf(cases: readonly FixHit[]): FigureValue {
  const count = cases.length;
  const total = cases.reduce((sum, hit) => sum + hit.entry.hours, 0);
  const average = count > 0 ? total / count : 0;
  const last = cases.reduce<string | null>(
    (latest, hit) => (latest === null || hit.entry.date > latest ? hit.entry.date : latest),
    null,
  );
  return [
    { label: 'Similar cases', value: String(count), sub: confidenceOf(count) },
    { label: 'On this machine', value: '—', sub: 'choose a machine to see its own history' },
    {
      label: 'Typical downtime',
      value: `${hoursText(medianHours(cases), 1)} hrs`,
      sub: `average ${hoursText(average, 1)} hrs (NO DT counts as 0)`,
    },
    {
      label: 'Last seen',
      value: last === null ? '—' : dmy(last),
      sub: 'most recent similar breakdown',
    },
  ];
}

/** One printed evidence row, in the platform's column order. */
function rowOf(hit: FixHit): string[] {
  return [
    `${Math.round(hit.score * 100)}%`,
    dmy(hit.entry.date),
    hit.entry.machineCode,
    hit.entry.problem,
    hit.entry.action,
    hoursText(hit.entry.hours, 2),
    hit.entry.doneBy,
  ];
}

/** The one table: the best 15 cases of the evidence set. */
function tableOf(cases: readonly FixHit[]): FigureValue {
  const rows = cases.slice(0, ROW_LIMIT).map(rowOf);
  return {
    title: 'Similar breakdowns across the plant',
    header: ['Match', 'Date', 'Machine', 'Problem', 'What was done', 'Down (hrs)', 'Done by'],
    rows,
    rowCount: rows.length,
  };
}

/** The whole figure: the page and the similar tickets behind it. */
export const fixFinderFigure: Computer = ({ data, asOf }) => {
  const index = buildIndex(data);
  const group = problemGroupOf(QUERY_ROW, {}, groupsOf(data));
  const terms = termsOf(FIX_FINDER_QUERY, index);
  const similar = similarCases(hitsOf(index, terms, group === OTHER_PROBLEM ? null : group));
  if (similar.length === 0) return { value: null, drillIds: [] };
  const page = {
    page: 'ff',
    title: 'Fix Finder',
    kpis: kpisOf(similar),
    tables: [tableOf(similar)],
    charts: [],
  };
  return {
    value: { screen: 'fix-finder', asOf, pages: [page] } as unknown as FigureValue,
    drillIds: similar.map((hit) => hit.entry.ticketId),
  };
};
