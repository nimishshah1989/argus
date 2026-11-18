import { isProduction } from './machine-facts.js';
import {
  OTHER_PROBLEM,
  PROBLEM_GROUPS,
  problemGroupOf,
  type ProblemGroup,
} from './problem-groups.js';
import { isPm, sourcedReports } from './rows.js';
import type { EngineData } from './types.js';

/**
 * A10's suggested-group card (ticket 41, packet 41d-2): the platform's own Naive Bayes, ported whole. It learns the
 * wording of the entries the keyword rules (or a plant's manual fix) already placed and suggests a group for each
 * entry they could not place. The classifier is the platform's small text model: word and adjacent-word features,
 * multinomial Laplace smoothing and a softmax over the labels. Nothing here prints a cell; 41d-2's page uses the
 * suggestions, and the model's own metadata (its 1,248 training entries and 76% cross-validated accuracy) is what
 * the platform's card description says. The key holds no description slot, so the page itself carries no prose (R9).
 *
 * Training labels are only the PLACED entries: the groups the plant's list or a manual fix chose. The unplaced
 * entries teach nothing, which is what makes the card a suggestion rather than an echo.
 */

/** The platform's classifier stop set (`ML_STOP`), its own list; not the words table's set. */
export const ML_STOP: ReadonlySet<string> = new Set(
  `the a an and or of to in on at is was were are be been it its this that with for from by as not no nil na
ok done did do has had have after before then than but so if when while into out up down again also now`.split(
    /\s+/,
  ),
);

/** The platform trains only once there is enough to learn from (40 placed entries). */
const TRAIN_MIN = 40;
/** The platform's five-fold cross-validation. */
const FOLDS = 5;
/** The platform's additive smoothing for a feature unseen under a label. */
const ALPHA = 0.5;
/** A feature is a word of two characters or more, or a pair of them. */
const FEATURE_MIN = 2;

/** One training example: the problem and action text as a string, and the group the plant placed it in. */
export interface LabeledExample {
  readonly text: string;
  readonly label: string;
}

interface LabelStats {
  count: number;
  /** The label's total feature tokens, the Laplace denominator's other half. */
  tokens: number;
  readonly features: Map<string, number>;
}

/** A trained multinomial model: per-label counts, the shared vocabulary and the labels in the plant's group order. */
export interface ProblemModel {
  readonly labels: ReadonlyMap<string, LabelStats>;
  readonly vocab: ReadonlySet<string>;
  readonly total: number;
  readonly order: readonly string[];
}

/** What the classifier answers for one entry: the winning group and its softmax probability. */
export interface ProblemSuggestion {
  readonly label: string;
  readonly probability: number;
}

/** The model and the two numbers the platform's card description prints: its training size and its 5-fold accuracy. */
export interface ProblemTraining {
  readonly model: ProblemModel | null;
  readonly trainedOn: number;
  readonly accuracy: number | null;
}

/** The platform's stemmer: a long word loses its "ing", "ed" or a single trailing "s" (never "ss"). */
function stem(word: string): string {
  if (word.length > 5 && /ing$/.test(word)) return word.slice(0, -3);
  if (word.length > 4 && /ed$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && /s$/.test(word) && !/ss$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * One text's features: lowercased words split on anything that is not alphanumeric, two letters or more, digits
 * dropped, stop words dropped, stemmed, deduplicated, plus every adjacent bigram `a_b` (the platform's `mlFeat`).
 */
export function problemFeatures(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length >= FEATURE_MIN && !ML_STOP.has(word) && !/^[0-9]+$/.test(word))
    .map(stem);
  const features = new Set(words);
  for (let index = 0; index < words.length - 1; index += 1) {
    features.add(`${words[index]}_${words[index + 1]}`);
  }
  return [...features];
}

/** Count one label's feature tokens; every feature counts once per example, as the platform's Set does. */
function tallyLabel(stats: LabelStats, features: readonly string[]): void {
  stats.count += 1;
  stats.tokens += features.length;
  for (const feature of features)
    stats.features.set(feature, (stats.features.get(feature) ?? 0) + 1);
}

/**
 * Train the model over the placed entries. The labels are seeded in the plant's group order, so a tied softmax
 * keeps that order (the plan's tie rule); the platform's own insertion order differs only on an exact tie.
 */
export function trainModel(
  examples: readonly LabeledExample[],
  order: readonly string[],
): ProblemModel {
  const labels = new Map<string, LabelStats>(
    order.map((name) => [name, { count: 0, tokens: 0, features: new Map<string, number>() }]),
  );
  const vocab = new Set<string>();
  for (const example of examples) {
    const stats = labels.get(example.label);
    if (stats === undefined) continue;
    const features = problemFeatures(example.text);
    tallyLabel(stats, features);
    for (const feature of features) vocab.add(feature);
  }
  return { labels, vocab, total: examples.length, order };
}

/**
 * The platform's prediction: only known features count, each label's log prior plus its smoothed log likelihood,
 * a softmax over those scores, and the best label wins. No known feature, or no trained label, answers nothing.
 */
export function predict(model: ProblemModel, text: string): ProblemSuggestion | null {
  const features = problemFeatures(text).filter((feature) => model.vocab.has(feature));
  const names = model.order;
  if (features.length === 0 || names.length === 0) return null;
  const vocabSize = model.vocab.size;
  const scores = names.map((name) => {
    const stats = model.labels.get(name)!;
    if (stats.count === 0) return Number.NEGATIVE_INFINITY;
    let score = Math.log(stats.count / model.total);
    for (const feature of features) {
      score += Math.log(
        ((stats.features.get(feature) ?? 0) + ALPHA) / (stats.tokens + ALPHA * vocabSize),
      );
    }
    return score;
  });
  const best = Math.max(...scores);
  const weights = scores.map((score) => Math.exp(score - best));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let winner = 0;
  for (let index = 1; index < weights.length; index += 1) {
    if (weights[index]! > weights[winner]!) winner = index;
  }
  return { label: names[winner]!, probability: weights[winner]! / total };
}

/** The platform's 5-fold accuracy: folds by index `i % 5`, each model tested on the fold it did not see. */
export function crossValidate(
  examples: readonly LabeledExample[],
  order: readonly string[],
  folds = FOLDS,
): number | null {
  if (examples.length < 2 * folds) return null;
  let right = 0;
  let tried = 0;
  for (let fold = 0; fold < folds; fold += 1) {
    const train = examples.filter((_, index) => index % folds !== fold);
    const test = examples.filter((_, index) => index % folds === fold);
    const model = trainModel(train, order);
    for (const example of test) {
      const answer = predict(model, example.text);
      if (answer === null) continue;
      tried += 1;
      if (answer.label === example.label) right += 1;
    }
  }
  return tried === 0 ? null : right / tried;
}

/** The plant's group list when it has edited one, else the platform default (R7). */
function groupListOf(data: EngineData): readonly ProblemGroup[] {
  const edited = data.settings?.problemGroups;
  return edited !== undefined && edited.length > 0 ? edited : PROBLEM_GROUPS;
}

/**
 * The entries the keyword rules or a manual fix place, in log order: the classifier's training labels. The text is
 * the problem and the corrective action together, as the platform's own examples are.
 */
export function labeledExamples(data: EngineData): LabeledExample[] {
  const production = new Set(data.machines.filter(isProduction).map((machine) => machine.id));
  const fixes = data.settings?.problemFixes ?? {};
  const groups = groupListOf(data);
  const examples: LabeledExample[] = [];
  for (const row of sourcedReports(data)) {
    if (!production.has(row.report.machineId) || isPm(row)) continue;
    const label = problemGroupOf(row.report, fixes, groups);
    if (label === OTHER_PROBLEM) continue;
    const { problem, correctiveAction } = row.report;
    examples.push({ text: `${problem ?? ''} ${correctiveAction ?? ''}`, label });
  }
  return examples;
}

/**
 * The A10 classifier for one plant: the model over the placed entries, and its training size and 5-fold accuracy.
 * A plant with fewer than 40 placed entries has no model, exactly as the platform shows "too few to learn from".
 */
export function problemTraining(data: EngineData): ProblemTraining {
  const examples = labeledExamples(data);
  const names = groupListOf(data).map((group) => group.name);
  const present = new Set(examples.map((example) => example.label));
  const order = names.filter((name) => present.has(name));
  if (examples.length < TRAIN_MIN || order.length === 0) {
    return { model: null, trainedOn: examples.length, accuracy: null };
  }
  const model = trainModel(examples, order);
  return { model, trainedOn: examples.length, accuracy: crossValidate(examples, order) };
}
