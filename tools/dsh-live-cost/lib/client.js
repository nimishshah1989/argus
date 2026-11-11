window.__ModuleLoader__.load({
  id: "@argus/dsh-live-cost",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const RATES = Object.freeze({
      "global.moonshotai.kimi-k3.1": Object.freeze({
        input: 4,
        output: 20,
        cacheRead: 0.2,
        cacheWrite: 5,
      }),
      "zai.glm-5": Object.freeze({
        input: 1,
        output: 3.2,
        cacheRead: 0,
        cacheWrite: 0,
      }),
      "global.zai.glm-5.3": Object.freeze({
        input: 1.68,
        output: 5.28,
        cacheRead: 0.312,
        cacheWrite: 2.1,
      }),
    });
    const CATEGORIES = Object.freeze([
      { key: "input", tokenKey: "uncachedInputTokens" },
      { key: "output", tokenKey: "outputTokens" },
      { key: "cacheRead", tokenKey: "cacheReadTokens" },
      { key: "cacheWrite", tokenKey: "cacheWriteTokens" },
    ]);
    const CATEGORY_LABELS = {
      input: "Input", output: "Output", cacheRead: "Cache read", cacheWrite: "Cache write",
    };
    const USD = new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4,
    });
    const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
    const NUMBER = new Intl.NumberFormat("en-US");
    function rateSummary() {
      return Object.entries(RATES).map(([id, rate]) =>
        `${id}: input $${rate.input} · output $${rate.output} · cache read $${rate.cacheRead} · cache write $${rate.cacheWrite}`,
      ).join("; ");
    }
    const CSS = `
.argus-live-cost{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width,760px);margin:0 auto 6px;padding:10px 12px;border:1px solid #99f6e4;border-radius:10px;background:#fff;color:#134e4a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;font-size:12px;line-height:1.45;box-shadow:0 2px 8px #134e4a12}
.argus-live-cost__header{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.argus-live-cost__title{margin:0;font-size:13px;font-weight:650}.argus-live-cost__total{text-align:right;font-variant-numeric:tabular-nums}.argus-live-cost__usd{display:block;color:#0f766e;font-size:20px;font-weight:700;line-height:1.2}.argus-live-cost__inr{color:#476664}
.argus-live-cost__categories{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:8px 0}.argus-live-cost__category{min-width:0;padding:6px;border-radius:6px;background:#f0fdfa}.argus-live-cost__category span{display:block;overflow-wrap:anywhere}.argus-live-cost__category span:first-child{font-weight:600}.argus-live-cost__figures{font-variant-numeric:tabular-nums}
.argus-live-cost__details{border-top:1px solid #ccfbf1}.argus-live-cost__summary{display:flex;align-items:center;min-height:44px;cursor:pointer;font-weight:600}.argus-live-cost__summary:focus-visible{outline:2px solid #0f766e;outline-offset:2px;border-radius:3px}.argus-live-cost__sessions{margin:0;padding:0;list-style:none}.argus-live-cost__session{padding:6px 0;border-top:1px solid #f0fdfa;overflow-wrap:anywhere}.argus-live-cost__session-name{font-weight:600}.argus-live-cost__meta{color:#476664}.argus-live-cost__note{margin:6px 0 0;font-weight:600}.argus-live-cost__source{margin:6px 0 0;color:#476664}.argus-live-cost__disclaimer{margin:4px 0 0;font-weight:600}
@media(max-width:520px){.argus-live-cost__categories{grid-template-columns:repeat(2,minmax(0,1fr))}.argus-live-cost__total{text-align:left}}
`;
    if (typeof document !== "undefined" && !document.querySelector("style[data-argus-live-cost]")) {
      const style = document.createElement("style");
      style.dataset.argusLiveCost = "";
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    function normalizeUsage(value) {
      const source = value && typeof value === "object"
        ? value.totals && typeof value.totals === "object" ? value.totals : value
        : {};
      const tokens = {};
      for (const { tokenKey } of CATEGORIES) {
        const count = source[tokenKey];
        tokens[tokenKey] = Number.isFinite(count) && count >= 0 ? count : 0;
      }
      return tokens;
    }

    function read(operation, fallback) {
      try {
        return operation();
      } catch {
        return fallback;
      }
    }

    function snapshotOf(face) {
      if (!face) return undefined;
      return typeof face.getSnapshot === "function"
        ? read(() => face.getSnapshot(), undefined)
        : face;
    }

    function catalogEntries(snapshot) {
      const candidates = [
        snapshot,
        snapshot?.values,
        snapshot?.subagentCatalog,
        snapshot?.values?.subagentCatalog,
      ];
      return candidates.find(Array.isArray) ?? [];
    }

    function modelIdFrom(values) {
      for (const holder of [values, values?.session, values?.llm]) {
        const lastUsed = holder?.modelSelection?.lastUsed?.model;
        if (typeof lastUsed === "string" && lastUsed.trim()) return lastUsed;
        for (const key of ["model", "modelId", "activeModel", "selectedModel"]) {
          const candidate = holder?.[key];
          if (typeof candidate === "string" && candidate.trim()) return candidate;
          const id = candidate?.id ?? candidate?.modelId ?? candidate?.model;
          if (typeof id === "string" && id.trim()) return id;
        }
      }
      return undefined;
    }

    function sessionName(sessions, id, values, fallback) {
      const row = read(() => sessions.list?.getSnapshot()?.byId?.[id], undefined);
      return row?.displayTitle ?? values?.title ?? fallback ?? id;
    }

    function collectCostReport(sessionId, sessions) {
      const binding = read(() => sessions.binding(sessionId), undefined);
      const projections = binding?.session?.projections;
      const sessionSnapshot = read(() => binding?.session?.getSnapshot(), undefined);
      const leadValues = read(() => sessions.manager?.projectionValues(sessionId), undefined);
      const leadUsage = snapshotOf(read(() => projections?.faceOf("tokenUsage"), undefined));
      const leadCatalog = snapshotOf(read(() => projections?.faceOf("subagentCatalog"), undefined));
      const queue = [{ id: sessionId, values: leadValues, sessionSnapshot,
        usage: leadUsage, catalog: leadCatalog, name: sessionId }];
      const seen = new Set();
      const records = [];
      while (queue.length) {
        const item = queue.shift();
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        const values = item.values ?? read(() => sessions.manager?.projectionValues(item.id), undefined);
        const usage = item.usage ?? values?.tokenUsage;
        records.push({
          id: item.id,
          name: sessionName(sessions, item.id, values, item.sessionSnapshot?.title ?? item.name),
          model: modelIdFrom(values) ?? modelIdFrom(item.sessionSnapshot),
          usage,
          usageAvailable: Boolean(usage && typeof usage === "object"),
        });
        for (const child of catalogEntries(item.catalog ?? values?.subagentCatalog)) {
          if (!child || typeof child.id !== "string" || child.mode === "external") continue;
          queue.push({ id: child.id, name: child.label,
            values: read(() => sessions.manager?.projectionValues(child.id), undefined) });
        }
      }
      return aggregateCost(records);
    }

    function roundMoney(value) {
      return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
    }

    function aggregateCost(records) {
      const categories = CATEGORIES.map(({ key }) => ({
        key, tokens: 0, cost: 0, unpricedTokens: 0,
      }));
      let totalUsd = 0;
      const sessions = records.map((record) => {
        const usage = normalizeUsage(record.usage);
        const rate = RATES[record.model];
        let cost = 0;
        CATEGORIES.forEach(({ key, tokenKey }, index) => {
          const categoryCost = rate ? usage[tokenKey] * rate[key] / 1_000_000 : 0;
          categories[index].tokens += usage[tokenKey];
          categories[index].cost += categoryCost;
          if (!rate) categories[index].unpricedTokens += usage[tokenKey];
          cost += categoryCost;
        });
        totalUsd += cost;
        return {
          ...record,
          usage,
          priced: Boolean(rate),
          cost: rate ? roundMoney(cost) : null,
        };
      });
      for (const category of categories) category.cost = roundMoney(category.cost);
      totalUsd = roundMoney(totalUsd);
      const unpricedModels = [...new Set(sessions
        .filter((session) => !session.priced)
        .map((session) => session.model || "Model unavailable"))];
      return {
        sessions, categories, totalUsd, totalInr: roundMoney(totalUsd * 90), unpricedModels,
      };
    }

    function watchCostChanges(sessionId, sessions, publish) {
      const disposers = [];
      const binding = read(() => sessions.binding(sessionId), undefined);
      for (const key of ["tokenUsage", "subagentCatalog"]) {
        const face = read(() => binding?.session?.projections?.faceOf(key), undefined);
        const dispose = read(() => face?.subscribe(publish), undefined);
        if (typeof dispose === "function") disposers.push(dispose);
      }
      const disposeManager = read(() => sessions.manager?.subscribe(publish), undefined);
      if (typeof disposeManager === "function") disposers.push(disposeManager);
      return () => {
        for (const dispose of disposers) read(() => dispose(), undefined);
      };
    }

    function createCostSource(sessionId, sessions, timers = globalThis) {
      let snapshot = { ...collectCostReport(sessionId, sessions), updatedAt: Date.now() };
      const listeners = new Set();
      let subscriptions = 0, timer, generation = 0, refreshing = null;
      let stopWatching = () => {};

      function publish() {
        snapshot = { ...collectCostReport(sessionId, sessions), updatedAt: Date.now() };
        for (const listener of [...listeners]) listener();
      }

      function refresh() {
        if (subscriptions === 0) return Promise.resolve();
        if (refreshing) return refreshing;
        const version = generation;
        const ids = collectCostReport(sessionId, sessions).sessions.slice(1)
          .map((session) => session.id);
        refreshing = (async () => {
          try {
            await Promise.allSettled(ids.map((id) => Promise.resolve()
              .then(() => sessions.refreshProjections?.(id))));
            if (version === generation && subscriptions > 0) publish();
          } finally {
            if (version === generation) refreshing = null;
          }
        })();
        return refreshing;
      }
      function start() {
        generation += 1;
        stopWatching = watchCostChanges(sessionId, sessions, publish);
        timer = timers.setInterval(refresh, 5_000);
        void refresh();
      }

      function stop() {
        generation += 1;
        refreshing = null;
        stopWatching();
        stopWatching = () => {};
        if (timer !== undefined) timers.clearInterval(timer);
        timer = undefined;
      }
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          subscriptions += 1;
          if (subscriptions === 1) start();
          let active = true;
          return () => {
            if (!active) return;
            active = false;
            listeners.delete(listener);
            subscriptions -= 1;
            if (subscriptions === 0) stop();
          };
        },
      };
    }

    function Category({ category }) {
      const unpriced = category.unpricedTokens > 0;
      const cost = !unpriced ? USD.format(category.cost)
        : category.cost === 0 ? "Unpriced" : `${USD.format(category.cost)} + unpriced`;
      return h("div", { className: "argus-live-cost__category" },
        h("span", null, CATEGORY_LABELS[category.key]),
        h("span", { className: "argus-live-cost__figures" },
          `${NUMBER.format(category.tokens)} tokens`),
        h("span", { className: "argus-live-cost__figures" }, cost));
    }

    function SessionBreakdown({ sessions }) {
      return h("details", { className: "argus-live-cost__details" },
        h("summary", { className: "argus-live-cost__summary" },
          `Per-session breakdown · ${sessions.length} included`),
        h("ul", { className: "argus-live-cost__sessions" }, sessions.map((session, index) => {
          const tokens = CATEGORIES.reduce((sum, { tokenKey }) => sum + session.usage[tokenKey], 0);
          const model = session.model ?? "Model unavailable";
          const usage = session.usageAvailable
            ? `${NUMBER.format(tokens)} tokens` : "Usage unavailable";
          const cost = !session.priced ? "Unpriced"
            : session.usageAvailable ? USD.format(session.cost) : "Cost unavailable";
          return h("li", { className: "argus-live-cost__session", key: session.id },
            h("div", { className: "argus-live-cost__session-name" },
              `${session.name} · ${index === 0 ? "lead" : "child"}`),
            h("div", { className: "argus-live-cost__meta" },
              `${model} · ${usage} · ${cost}`));
        })));
    }

    function LiveCostDock({ source }) {
      const report = React.useSyncExternalStore(
        source.subscribe, source.getSnapshot, source.getSnapshot,
      );
      const hasUnpriced = report.unpricedModels.length > 0;
      const unavailable = report.sessions.filter((session) => !session.usageAvailable).length;
      const hasPartial = hasUnpriced || unavailable > 0;
      return h("section", {
        className: "argus-live-cost", "aria-label": "Live estimated model cost",
      },
      h("div", { className: "argus-live-cost__header" },
        h("div", null,
          h("h2", { className: "argus-live-cost__title" }, "Live model cost"),
          h("span", null, `${report.sessions.length} sessions · updated ${new Date(report.updatedAt).toLocaleTimeString()}`)),
        h("div", { className: "argus-live-cost__total" },
          h("span", null, hasPartial ? "Estimated available total" : "Estimated total"),
          h("span", { className: "argus-live-cost__usd" }, USD.format(report.totalUsd)),
          h("span", { className: "argus-live-cost__inr" },
            `${INR.format(report.totalInr)} illustrative · ₹90/USD`))),
      h("div", { className: "argus-live-cost__categories" },
        report.categories.map((category) => h(Category, { category, key: category.key }))),
      unavailable > 0 && h("p", { className: "argus-live-cost__note" },
        `Usage unavailable for ${unavailable} session${unavailable === 1 ? "" : "s"}; shown total is partial.`),
      hasUnpriced && h("p", { className: "argus-live-cost__note" },
        `Priced subtotal only; unpriced: ${report.unpricedModels.join(", ")}. Unknown cost is excluded.`),
      h(SessionBreakdown, { sessions: report.sessions }),
      h("p", { className: "argus-live-cost__source" },
        `Sources: Harness tokenUsage + model projections. Built-in rates per 1M: ${rateSummary()}.`),
      h("p", { className: "argus-live-cost__disclaimer" },
        "Estimate, not an AWS bill. Provider invoices may differ."));
    }

    const inject = ["slots", "sessions"];
    function apply(ctx) {
      const sessions = ctx.sessions;
      ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
        name: "conversation.input.dock",
        id: "live-cost",
        order: 20,
        inject: (sessionId) => ({ source: createCostSource(sessionId, sessions) }),
      }, LiveCostDock));
    }

    return {
      RATES,
      inject,
      apply,
      LiveCostDock,
      normalizeUsage,
      aggregateCost,
      catalogEntries,
      modelIdFrom,
      collectCostReport,
      createCostSource,
    };
  },
});
