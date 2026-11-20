// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { realReply } from '../figures/real-reply.js';
import { answerKey, keyPage, realT } from '../printed-page/test-support.js';
import { forecastLabModel, FIGURE } from './adapter.js';

const reply = answerKey('forecast-lab', FIGURE, 42);
const model = forecastLabModel(reply, realT)!;
const page = keyPage(reply);
const says = (point: { text: string }[]) => point.map((s) => s.text).join('');

describe('Forecast Lab from the engine reply', () => {
  it('prints both tables whole and draws the forecast-against-actual line chart', () => {
    expect(model.tables.map((table) => table.rows.length)).toEqual(
      page.tables.map((t) => t.rows.length),
    );
    expect(model.charts.map((chart) => chart.spec.kind)).toEqual(['line']);
    const shown = new Set(
      model.tables.flatMap((t) =>
        t.rows.flatMap((row) => row.map((c) => c.text.replace(': ', ''))),
      ),
    );
    const printed = page.tables.flatMap((table) => table.rows.flat());
    expect(printed.filter((cell) => !shown.has(cell.replace(': ', '')))).toEqual([]);
  });

  it('says a method’s name apart from its note, and keeps the engine’s verdict word first', () => {
    const first = model.tables[0]!.rows[0]!;
    expect(first[0]!.text.startsWith('Current model in use: Each machine')).toBe(true);
    expect(first[8]!.text).toBe('Baseline: The model used today.');
    const second = model.tables[0]!.rows[1]!;
    expect(second[0]!.text.startsWith('Age-adjusted: Same, but')).toBe(true);
    expect(second[8]!.text.startsWith('Do not adopt: Accuracy is 0.2% worse')).toBe(true);
  });

  it('answers with the model in use’s score and says whether any other method is better enough to adopt', () => {
    expect(says(model.verdict.headline)).toBe(
      'Over the last 7 months the model in use scored 1.85 (lower is better); no other method is good enough to replace it.',
    );
    expect(model.verdict.why.map(says)).toContain(
      'The plant stayed inside the model in use’s 80% range in 4 of 7 months.',
    );
    expect(model.verdict.why.map(says).join(' ')).toContain('scored best on accuracy');
  });

  it('keeps every score sortable by the number it carries', () => {
    const table = model.tables[0]!;
    const score = table.header.findIndex((h) => h.label.startsWith('Accuracy score'));
    expect(table.header[score]!.numeric).toBe(true);
    expect(table.rows[0]![score]!.sort).toBe(1.85);
  });

  it('opens the machines behind the figure from the real engine reply', () => {
    const real = forecastLabModel(realReply(), realT)!;
    expect(real.drill).toEqual({
      figure: FIGURE,
      label: 'Show the rows behind Forecast Lab',
    });
  });

  it('says nothing was computed rather than drawing nothing', () => {
    const none = { ...reply, figures: [{ ...reply.figures[0]!, status: 'not_computed' as const }] };
    expect(forecastLabModel(none, realT)).toBeNull();
  });
});
