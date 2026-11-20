import i18n from 'i18next';
import key from '../../../../../../fixtures/answer-key/a1-bd-pm.json' with { type: 'json' };
import { keyReply } from '../printed-page/key-reply.js';
import { bdPmModel } from './adapter.js';

/** The gallery's version of this screen: the engine's frozen answer for the 11 November plant, through the live adapter. */
export const bdPmModelFromKey = () =>
  Promise.resolve(bdPmModel(keyReply('a1-bd-pm', 40, key), i18n.t.bind(i18n)));
