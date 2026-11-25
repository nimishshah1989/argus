/**
 * S22 Money Matters in the v2 look (ticket 644, wireframe design/wireframes/S22-money-matters.html): the verdict, the
 * three tile headings, the yardsticks the kit has no words for, and the levers line. Only S22 reads these (ADR 0035).
 * The refusal keeps v1's words (`analytics.money.refused*`); the tables, chart and figures are the engine's own text.
 */
export const analyticsV2MoneyEn = {
  'v2mm.verdict': 'Breakdowns cost {{lost}} ({{period}}); {{gain}} could have been added.',
  'v2mm.biggest': '{{name}} is the largest loss: {{money}}, {{share}} of it.',
  'v2mm.group.cost': 'What breakdowns cost',
  'v2mm.group.next': 'Next month',
  'v2mm.group.price': 'The price of an hour',
  'v2mm.yardstick.vsAverage': '{{delta}} vs the average month',
  'v2mm.yardstick.baseline': 'The baseline for the other three',
  'v2mm.yardstick.year': 'Same hours, whole year',
  'v2mm.yardstick.machines': 'Same on all {{n}} machines',
  'v2mm.yardstick.rate': '= throughput, full value counted',
  'v2mm.levers':
    '{{name}} is the biggest lever: {{money}}, {{pct}}% of the {{total}} all four make together. They overlap by {{overlap}} hrs, so the total is not their sum.',
  'v2mm.source':
    'Source: the breakdown log, priced at the throughput in Settings, Analytics profile. Records to {{date}}.',
};
