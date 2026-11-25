import type { Sheet } from '@uptimo/shared/xlsx';
import type { Reason } from '../../../ui/v2/reason-chip.js';
import type { ActionCenterModel } from './model.js';

/** Sweep #706, batch A (ADR 0041): the Action Center's risk reasons as chips, and its two tables for Excel. */

/**
 * The engine's risk `why` as reason chips (ADR 0036 R17). The engine writes it as the rule labels it counted, in the
 * order they first counted, joined by ONE space, a label followed by ` x<N>` when that rule counted N (≥ 2) times
 * (`riskRows` in `packages/domain/src/analytics/action-center-figure.ts`), e.g.
 * "Frequent breakdowns x2 Recurring fault Ageing machines". Labels contain spaces, so they are matched against
 * `labels` (`Object.values(board.types)`: the board's own type labels, the exact words the engine joined), never
 * split on spaces. Rule, left to right from the start of `why`:
 * 0. Trim `why` first.
 * 1. Of the labels that the remaining text starts with AND that are followed there by the end or a space, take the
 *    longest; the reason's `text` is that label.
 * 2. If the text right after it is ` x<digits>` or ` ×<digits>` followed by a space or the end, `n` = those digits as a
 *    number and that part is consumed; otherwise the reason has no `n` (the property is absent, not undefined).
 * 3. Consume the one space separating it from the next label, and repeat.
 * 4. When no label matches the remaining text, the whole remaining text, trimmed, is ONE reason with no `n` (plain text
 *    is kept as printed, never dropped or split); a remainder that is empty after trimming adds nothing.
 * `why` empty or only spaces → `[]`. The words are the engine's own; nothing is translated or re-worded.
 * Example: "Frequent breakdowns x2 Recurring fault" →
 * [{ text: 'Frequent breakdowns', n: 2 }, { text: 'Recurring fault' }].
 */
export function riskReasons(why: string, labels: readonly string[]): Reason[] {
  const reasons: Reason[] = [];
  let rest = why.trim();
  while (rest !== '') {
    const label = labels
      .filter(
        (l) =>
          l !== '' && rest.startsWith(l) && (rest.length === l.length || rest[l.length] === ' '),
      )
      .sort((a, b) => b.length - a.length)[0];
    if (label === undefined) {
      reasons.push({ text: rest });
      break;
    }
    rest = rest.slice(label.length);
    const times = /^ [x×](\d+)(?= |$)/.exec(rest);
    if (times) rest = rest.slice(times[0].length);
    reasons.push(times ? { text: label, n: Number(times[1]) } : { text: label });
    rest = rest.slice(1).trimStart();
  }
  return reasons;
}

/**
 * The Action Center's "Download Excel" (ADR 0036 R6, ADR 0041; no DOC. NO.: the page is not in `DOC_REF`). Two sheets,
 * each its table as the page shows it, header row first, numbers as numbers (never re-rounded):
 * 1. name `model.words.table.title`; header [priority, nudge, type, entries, latest, status] from
 *    `model.words.columns`; one row per `model.nudges` entry in the model's order:
 *    [severityLabel, titleText, ruleLabel, count (number), latest.shown, status], where status is `statusLabel`, then,
 *    for a row whose status is not 'open' and whose `ack` is not null, its `ack.due` and `ack.note` that are not '',
 *    all joined with ' · '.
 * 2. name `model.words.risk.table.title`; header [machine, score, why] from `model.words.risk`; one row per
 *    `model.risk` entry in the model's order: [machine, score.value (number), why], where machine is the chip's label
 *    and the model joined by one space, trimmed (`"HMC-2 FMH 500"`; no chip → just the model).
 * Empty tables still give their sheet with the header row only.
 */
export function actionCenterSheets(model: ActionCenterModel): Sheet[] {
  const { columns: c, risk } = model.words;
  const status = (n: ActionCenterModel['nudges'][number]) =>
    [
      n.statusLabel,
      ...(n.status !== 'open' && n.ack ? [n.ack.due, n.ack.note].filter((s) => s !== '') : []),
    ].join(' · ');
  return [
    {
      name: model.words.table.title,
      rows: [
        [c.priority, c.nudge, c.type, c.entries, c.latest, c.status],
        ...model.nudges.map((n) => [
          n.severityLabel,
          n.titleText,
          n.ruleLabel,
          n.count,
          n.latest.shown,
          status(n),
        ]),
      ],
    },
    {
      name: risk.table.title,
      rows: [
        [risk.machine, risk.score, risk.why],
        ...model.risk.map((r) => [
          `${r.machine?.label ?? ''} ${r.model}`.trim(),
          r.score.value,
          r.why,
        ]),
      ],
    },
  ];
}
