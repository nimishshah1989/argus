/* eslint-disable i18next/no-literal-string -- filter names and an entity kind, typed unions; every visible word comes from the model */
import { useContext, useMemo, useState } from 'react';
import { fill } from '../../../i18n/fill.js';
import { Button } from '../../../ui/v2/button.js';
import { BubblePlot } from '../../../ui/v2/bubble-plot.js';
import { DrillButton } from '../../../ui/v2/drill-button.js';
import { EntityOpenContext } from '../../../ui/v2/entity-chip.js';
import { Panel } from '../../../ui/v2/panel.js';
import { SelectField } from '../../../ui/v2/select-field.js';
import { NO_FILTERS, filterDots, optionsOf, type BubbleFilters } from './bubble.js';
import type { BubbleModel } from './model.js';
import type { Drill } from '../../../ui/v2/drill.js';

/** The three filters, a reset and the count of machines shown. */
function Filters({
  words,
  dots,
  filters,
  onChange,
  shown,
}: {
  words: BubbleModel['words'];
  dots: BubbleModel['dots'];
  filters: BubbleFilters;
  onChange: (next: BubbleFilters) => void;
  shown: number;
}) {
  const set = (name: keyof BubbleFilters) => (key: string) => onChange({ ...filters, [name]: key });
  return (
    <div className="v2-bubble-filters">
      <SelectField
        label={words.cell}
        all={words.all}
        value={filters.cell}
        options={optionsOf(dots, (d) => d.cell)}
        onChange={set('cell')}
      />
      <SelectField
        label={words.category}
        all={words.all}
        value={filters.category}
        options={optionsOf(dots, (d) => d.category)}
        onChange={set('category')}
      />
      <SelectField
        label={words.age}
        all={words.all}
        value={filters.age}
        options={words.bands}
        onChange={set('age')}
      />
      <Button onClick={() => onChange(NO_FILTERS)}>{words.resetFilters}</Button>
      <span role="status" className="v2-sub">
        {fill(words.shown, { n: shown })}
      </span>
    </div>
  );
}

/**
 * The bubble chart of every machine, as Bhavin's had it: filters for cell, type and age, a count of the machines shown,
 * zoom and pan, a tooltip with the machine's model, age, breakdowns, hours and repair time, and a press on a bubble
 * that opens the machine in the drawer. A cell is the machine's cell today; the engine's bubbles carry no shift, so
 * there is no shift filter yet.
 */
export function Bubble({
  title,
  sub,
  aria,
  bubble,
  drill,
}: {
  title: string;
  sub: string;
  aria: string;
  bubble: BubbleModel;
  drill?: Drill;
}) {
  const open = useContext(EntityOpenContext);
  const [filters, setFilters] = useState<BubbleFilters>(NO_FILTERS);
  const { words, dots } = bubble;
  const shown = useMemo(() => filterDots(dots, filters), [dots, filters]);
  return (
    <Panel title={title} sub={sub} aside={drill ? <DrillButton drill={drill} /> : undefined}>
      <Filters
        words={words}
        dots={dots}
        filters={filters}
        onChange={setFilters}
        shown={shown.length}
      />
      <BubblePlot
        dots={shown}
        words={{ ...words, aria }}
        onOpen={(dot) => open({ kind: 'machine', id: dot.id })}
      />
    </Panel>
  );
}
