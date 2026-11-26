import { Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { EngineTable } from '../../../ui/v2/domain/engine-table.js';
import { SourceLine } from '../../../ui/v2/domain/detail-parts.js';
import { DrillAction } from '../../../ui/v2/drill-action.js';
import { DownloadExcel } from '../../../ui/v2/download-excel.js';
import { Segmented } from '../../../ui/v2/segmented.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { TileSet } from '../../../ui/v2/tile-set.js';
import { Verdict } from '../../../ui/v2/verdict.js';
import { DOC_REF } from '@uptimo/shared/doc-ref';
import { EntityShell } from '../entity/EntityShell.js';
import { numberIn } from '../figures/read.js';
import type { RegistersModel } from './model.js';
import { registerSheets } from './sweep.js';

const REGISTER_PARAM = 'register';

/**
 * The Machines register: one page per register (CNC, Conventional, Process, Utilities, DG, Robots), each opening
 * with its count, load and age, then the controller and make splits, the by-category table and the machine list. The
 * register in view is in the URL, so a link opens it and Back leaves it. A machine or a cell opens in the drawer.
 */
export function RegistersView({
  model,
  nav,
  title,
}: {
  model: RegistersModel;
  nav: NavItem[];
  title: string;
}) {
  const [params, setParams] = useSearchParams();
  const page = model.pages.find((p) => p.id === params.get(REGISTER_PARAM)) ?? model.pages[0];
  const choose = (id: string) =>
    setParams(
      (was) => {
        const next = new URLSearchParams(was);
        next.set(REGISTER_PARAM, id);
        return next;
      },
      { replace: true },
    );
  return (
    <EntityShell nav={nav} title={title}>
      {page ? (
        <>
          <Segmented
            label={model.words.tabs}
            options={model.pages.map((p) => ({ key: p.id, label: p.label }))}
            value={page.id}
            onChange={choose}
          />
          <Verdict verdict={page.verdict} whyLabel={model.words.why} />
          {model.drill ? <DrillAction drill={model.drill} /> : null}
          <TileSet
            items={page.kpis.map((kpi) => ({ kpi, n: numberIn(kpi.value) ?? Number.NaN }))}
          />
          {page.tables.map((table, i) => (
            <Fragment key={`${page.id}-${table.id}`}>
              {model.takeaways?.[`${page.id}-${table.id}`] ? (
                <Takeaway data={model.takeaways[`${page.id}-${table.id}`]!} />
              ) : null}
              {i === 0 ? (
                <DownloadExcel
                  file={`machines-register-${new Date().toISOString().slice(0, 10)}`}
                  sheets={registerSheets(page)}
                  docRef={DOC_REF.machines}
                />
              ) : null}
              <EngineTable table={table} />
            </Fragment>
          ))}
          <SourceLine text={model.source} />
        </>
      ) : null}
    </EntityShell>
  );
}
