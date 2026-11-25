/* eslint-disable i18next/no-literal-string -- the two forms of the card are typed ids, not copy; every visible word comes from the model */
import { useState, type ReactElement } from 'react';
import { Panel } from '../../../ui/v2/panel.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { PageBody } from '../printed-page/PageBody.js';
import { sectionOf } from './adapter.js';
import type { ManpowerModel } from './model.js';

type Form = 'category' | 'code';

/**
 * The Specialization card, as v1 had it: the category matrix behind a category/code toggle. The engine's reply carries
 * only the category form, so the code form says "Not computed yet" rather than a made-up table or a dead pill.
 */
function SpecializationCard({
  words,
  drawn,
}: {
  words: ManpowerModel['specialization'];
  drawn: ReactElement;
}) {
  const [form, setForm] = useState<Form>('category');
  return (
    <div className="v2-stack">
      <Segmented
        label={words.toggle}
        options={[
          { key: 'category', label: words.category },
          { key: 'code', label: words.code },
        ]}
        value={form}
        onChange={setForm}
      />
      {form === 'category' ? (
        drawn
      ) : (
        <Panel title={words.table}>
          <p className="v2-sub">{words.notComputed}</p>
        </Panel>
      )}
    </div>
  );
}

/** The page the engine printed, in the v2 look: see `PageBody`; the Specialization table keeps v1's toggle. */
export function ManpowerView({
  model,
  nav,
  title,
}: {
  model: ManpowerModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <PageBody
      model={model}
      nav={nav}
      title={title}
      around={(table, drawn) => {
        const id = sectionOf(table.title, model.words.pair.fallback);
        const takeaway = id === undefined ? null : (model.takeaways?.[id] ?? null);
        const body =
          table.title === model.specialization.table ? (
            <SpecializationCard words={model.specialization} drawn={drawn} />
          ) : (
            drawn
          );
        return takeaway ? (
          <>
            <Takeaway data={takeaway} />
            {body}
          </>
        ) : (
          body
        );
      }}
    />
  );
}
