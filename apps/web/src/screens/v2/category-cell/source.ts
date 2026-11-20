import i18n from 'i18next';
import key from '../../../../../../fixtures/answer-key/a2-category-cell.json' with { type: 'json' };
import { keyReply } from '../printed-page/key-reply.js';
import { categoryCellModel } from './adapter.js';

/** The gallery's version of this screen: the engine's frozen answer for the 11 November plant, through the live adapter. */
export const categoryCellModelFromKey = () =>
  Promise.resolve(categoryCellModel(keyReply('a2-category-cell', 40, key), i18n.t.bind(i18n)));
