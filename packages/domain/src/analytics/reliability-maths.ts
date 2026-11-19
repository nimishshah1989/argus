/**
 * The reliability estimators (ticket 67, R5/R8/R9): a two-parameter Weibull by maximum likelihood with the scale
 * in closed form and a golden-section search for the shape, the Kaplan-Meier product-limit, and the Crow-AMSAA
 * power law with its two-standard-error word. Plain TypeScript and no statistics package: a Lanczos Gamma, one
 * one-dimensional search and three product/sum loops.
 */

/** The golden-section step: the profile likelihood is one-dimensional once lambda is substituted. */
const GOLDEN = (Math.sqrt(5) - 1) / 2;
/** The KM step is quantised to a millionth of an hour: floating noise from the month-spread clock is not a tie. */
const KM_KEY = 1e6;

export type TrendLabel = 'improving' | 'worsening' | 'no_clear_trend';

/** The first step at or below a quarter, a half and three quarters: a step's time, never an interpolation. */
export interface Quartiles {
  q25: number;
  median: number;
  q75: number;
}

/** The Crow-AMSAA power law: beta < 1 improving, > 1 worsening, labelled only past two standard errors. */
export interface Trend {
  beta: number;
  n: number;
  label: TrendLabel;
}

/** The Weibull's answer: the shape and scale on the MTBF's working hours, and lambda x Gamma(1 + 1/shape). */
export interface WeibullFit {
  shape: number;
  scale: number;
  mean: number;
}

/** One product-limit step: the interval's time and the survival after it. */
export interface KmStep {
  hours: number;
  survival: number;
}

export interface KmFit {
  steps: KmStep[];
  quartiles: Quartiles;
}

/** The Lanczos Gamma (g = 7, nine coefficients) with the reflection for x below a half: ten lines, no package. */
function gamma(x: number): number {
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  const shifted = x - 1;
  const t = shifted + 7.5;
  let sum = coefficients[0]!;
  for (let index = 1; index < coefficients.length; index += 1) {
    sum += coefficients[index]! / (shifted + index);
  }
  return Math.sqrt(2 * Math.PI) * Math.pow(t, shifted + 0.5) * Math.exp(-t) * sum;
}

/**
 * The two-parameter Weibull by maximum likelihood. For a fixed shape, the scale is closed form —
 * `lambda^k = (Σ x_i^k + Σ c_j^k) / m` — and substituting it leaves a one-dimensional profile likelihood in the
 * shape, maximised by a golden-section search on [1e-6, 50]. `m` counts complete intervals only: a censored
 * observation adds its term to the sum and nothing to `m`.
 */
export function weibullOf(complete: readonly number[], censored: readonly number[]): WeibullFit {
  const intervals = complete.filter((value) => value > 0 && Number.isFinite(value));
  const tails = censored.filter((value) => value > 0 && Number.isFinite(value));
  const m = intervals.length;
  if (m === 0) throw new RangeError('a Weibull fit needs at least one complete interval');
  const sumLog = intervals.reduce((sum, value) => sum + Math.log(value), 0);
  const powered = (shape: number): number => {
    let sum = 0;
    for (const value of intervals) sum += Math.pow(value, shape);
    for (const value of tails) sum += Math.pow(value, shape);
    return sum;
  };
  const profile = (shape: number): number =>
    m * Math.log(shape) - m * Math.log(powered(shape)) + m * Math.log(m) + (shape - 1) * sumLog - m;
  let low = 1e-6;
  let high = 50;
  let left = high - GOLDEN * (high - low);
  let right = low + GOLDEN * (high - low);
  let atLeft = profile(left);
  let atRight = profile(right);
  while (high - low > 1e-12) {
    if (atLeft < atRight) {
      low = left;
      left = right;
      atLeft = atRight;
      right = low + GOLDEN * (high - low);
      atRight = profile(right);
    } else {
      high = right;
      right = left;
      atRight = atLeft;
      left = high - GOLDEN * (high - low);
      atLeft = profile(left);
    }
  }
  const shape = (low + high) / 2;
  const scale = Math.pow(powered(shape) / m, 1 / shape);
  return { shape, scale, mean: scale * gamma(1 + 1 / shape) };
}

/**
 * The Kaplan-Meier product-limit: the complete intervals and the censored tails sorted together; at each distinct
 * time `S ← S·(1 - d/n)` on the risk set before removing the events and censorings, the censored observations
 * removed after the step. The value carries the three quartile steps, not the curve.
 */
export function kmOf(complete: readonly number[], censored: readonly number[]): KmFit {
  const observations: { hours: number; event: boolean }[] = [
    ...complete.filter((value) => value > 0).map((hours) => ({ hours, event: true })),
    ...censored.filter((value) => value >= 0).map((hours) => ({ hours, event: false })),
  ].sort((left, right) => left.hours - right.hours);
  const steps: KmStep[] = [];
  let survival = 1;
  let atRisk = observations.length;
  let index = 0;
  while (index < observations.length) {
    const key = Math.round(observations[index]!.hours * KM_KEY);
    const hours = observations[index]!.hours;
    let events = 0;
    let removed = 0;
    while (index < observations.length && Math.round(observations[index]!.hours * KM_KEY) === key) {
      if (observations[index]!.event) events += 1;
      removed += 1;
      index += 1;
    }
    if (events > 0) {
      survival *= 1 - events / atRisk;
      steps.push({ hours, survival });
    }
    atRisk -= removed;
  }
  const atOrBelow = (level: number): number => {
    const step = steps.find((candidate) => candidate.survival <= level);
    return step?.hours ?? steps.at(-1)?.hours ?? 0;
  };
  return {
    steps,
    quartiles: { q25: atOrBelow(0.75), median: atOrBelow(0.5), q75: atOrBelow(0.25) },
  };
}

/**
 * The Crow-AMSAA power-law MLE on the same events: `beta = n / Σ ln(T/t_i)` with each machine's own end `T` (a
 * category pools its machines). `se = beta / √n`, and the word is improving/worsening only when the slope is more
 * than two standard errors from one; otherwise `no_clear_trend`. The slope travels beside it either way.
 */
export function amsaaOf(bases: readonly { times: readonly number[]; end: number }[]): Trend {
  let n = 0;
  let spread = 0;
  for (const base of bases) {
    for (const time of base.times) {
      if (time <= 0 || base.end <= 0) continue;
      n += 1;
      spread += Math.log(base.end / time);
    }
  }
  if (n === 0 || spread <= 0)
    throw new RangeError('a Crow-AMSAA trend needs an event before its end');
  const beta = n / spread;
  const standardError = beta / Math.sqrt(n);
  const label: TrendLabel =
    beta - 1 > 2 * standardError
      ? 'worsening'
      : 1 - beta > 2 * standardError
        ? 'improving'
        : 'no_clear_trend';
  return { beta, n, label };
}
