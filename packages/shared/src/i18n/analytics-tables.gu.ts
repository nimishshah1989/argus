import { gujarati } from './blank.js';
import { analyticsTablesEn } from './analytics-tables.en.js';

export const analyticsTablesGu = gujarati(analyticsTablesEn, {
  'analytics.keytable.previous': 'પાછલું',
  'analytics.keytable.next': 'આગળનું',
  'analytics.keytable.page': 'પાનું {{page}} / {{pages}}',
  'analytics.keytable.range': '{{total}} માંથી {{from}} થી {{to}}',
  'analytics.keytable.empty': 'કોઈ હરોળ નથી',
});
