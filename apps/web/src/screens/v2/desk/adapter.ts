import type { TFunction } from 'i18next';
import type { OpenInput, OpenModel } from './model.js';

/**
 * The Open screen from the `/state`, `/config` and `/auth/me` replies. Lists and counts come from v1's
 * `screens/desk/openLists.ts` (kept, imported); cards' quick button from `components/actionSpecs.ts` `quickSpec`;
 * task "today" from `plantToday` in the plant's time zone; the two takeaways are computed here.
 */
export function openModel(input: OpenInput, t: TFunction): OpenModel {
  void input;
  void t;
  throw new Error('not implemented');
}
