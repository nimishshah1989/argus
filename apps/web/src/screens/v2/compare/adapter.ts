import type { TFunction } from 'i18next';
import type { CompareReply } from '@uptimo/shared/compare-pair';
import type { Page } from '../printed-page/printed.js';
import type { CompareModel } from './model.js';

/** A reply with a comparison in it. */
export type ComparedReply = CompareReply & {
  pair: NonNullable<CompareReply['pair']>;
  years: NonNullable<CompareReply['years']>;
};

/**
 * Everything the live Compare prints (ticket 587, ADR 0020 §2–5): verdict, picker, key figures, the two boxes,
 * "What is different", the weekly chart, v1's six tables and the source line, from the pair's years so far and the
 * engine's page. The rules are the ticket's "How it must behave"; every word is a `v2cmp.*` catalogue key.
 */
export function compareModel(reply: ComparedReply, page: Page, t: TFunction): CompareModel {
  void reply;
  void page;
  void t;
  throw new Error('not built');
}
