// @vitest-environment node
import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { realT } from '../printed-page/test-support.js';
import { otherWorkModel, reportModel, tabsModel } from './adapter.js';
import { FLOOR_OPERATOR, reportInput } from './fixture.js';
import { EMPTY_OTHER_WORK } from './model.js';
import { FloorFrame, OtherWorkView, ReportView, type ReportActions } from './View.js';

/** ADR 0034: one render smoke per screen. The e2e specs pin the names and the page order. */
const draw = (node: ReactNode, path = '/floor') =>
  renderToStaticMarkup(
    h(
      QueryClientProvider,
      { client: new QueryClient() },
      h(MemoryRouter, { initialEntries: [path] }, node),
    ),
  );
const none = () => undefined;
const on: ReportActions = {
  ...{ onQuery: none, onGroup: none, onPick: none, onOther: none, onStopped: none },
  ...{ onRunning: none, onProblem: none, onStartNow: none, onCloseSheet: none },
  ...{ onAnother: none, onMine: none, onSend: () => Promise.resolve() },
};

describe('S27 floor renders (ADR 0045 T1)', () => {
  it('/floor Step 1 inside the floor frame: page title, step title, the search; never an h1', () => {
    const model = reportModel(FLOOR_OPERATOR, reportInput(), realT);
    const html = draw(
      h(FloorFrame, {
        tabs: tabsModel(false, '/floor', realT),
        children: h(ReportView, { model, on }),
      }),
    );
    expect(html).toContain('Report a problem');
    expect(html).toContain('Which machine?');
    expect(html).toContain('Find a machine');
    expect(html).not.toMatch(/<h1[\s>]/);
    // An operator's tab bar has no PM jobs link.
    expect(html).toContain('My complaints');
    expect(html).not.toContain('href="/floor/pm"');
  });

  it('/floor/other draws the work request with its Send', () => {
    const model = otherWorkModel(
      FLOOR_OPERATOR,
      { form: EMPTY_OTHER_WORK, startNow: false, sent: null },
      realT,
    );
    const html = draw(
      h(OtherWorkView, {
        model,
        on: {
          ...{ onForm: none, onStartNow: none, onBack: none, onAnother: none, onMine: none },
          onSend: () => Promise.resolve(),
        },
      }),
      '/floor/other',
    );
    expect(html).toContain('Other work (not a machine)');
    expect(html).toContain('Send work request');
    expect(html).not.toMatch(/<h1[\s>]/);
  });
});
