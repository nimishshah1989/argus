import test from "node:test";
import assert from "node:assert/strict";

let registration;
globalThis.window = {
  __ModuleLoader__: {
    load(value) {
      registration = value;
    },
  },
};

await import("../lib/client.js");
delete globalThis.window;

const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
};
const api = registration.factory((id) => {
  assert.equal(id, "react");
  return React;
});
const MODEL = "global.moonshotai.kimi-k3.1";

function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (typeof node.type === "function") return textOf(node.type(node.props));
  return textOf(node.props?.children);
}

function findElement(node, type) {
  if (node == null || typeof node !== "object") return undefined;
  if (Array.isArray(node)) return node.map((item) => findElement(item, type)).find(Boolean);
  if (node.type === type) return node;
  if (typeof node.type === "function") return findElement(node.type(node.props), type);
  return findElement(node.props?.children, type);
}

test("aggregates lead and child usage with direct and totals-wrapped projections", () => {
  const report = api.aggregateCost([
    {
      id: "lead",
      name: "Lead",
      model: MODEL,
      usage: {
        uncachedInputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheReadTokens: 2_000_000,
        cacheWriteTokens: 20_000,
      },
    },
    {
      id: "child",
      name: "Researcher",
      model: MODEL,
      usage: {
        totals: {
          uncachedInputTokens: 500_000,
          outputTokens: 50_000,
          cacheReadTokens: 0,
          cacheWriteTokens: 10_000,
        },
      },
    },
  ]);

  assert.equal(report.totalUsd, 9.55);
  assert.equal(report.totalInr, 859.5);
  assert.deepEqual(
    report.categories.map(({ key, tokens, cost }) => ({ key, tokens, cost })),
    [
      { key: "input", tokens: 1_500_000, cost: 6 },
      { key: "output", tokens: 150_000, cost: 3 },
      { key: "cacheRead", tokens: 2_000_000, cost: 0.4 },
      { key: "cacheWrite", tokens: 30_000, cost: 0.15 },
    ],
  );
});

test("keeps unknown models unpriced instead of borrowing the configured rate", () => {
  const report = api.aggregateCost([
    {
      id: "lead",
      name: "Lead",
      model: MODEL,
      usage: { uncachedInputTokens: 1_000_000 },
    },
    {
      id: "child",
      name: "Unknown child",
      model: "vendor.unconfigured-model",
      usage: { uncachedInputTokens: 2_000_000, outputTokens: 1_000_000 },
    },
  ]);

  assert.equal(report.totalUsd, 4);
  assert.equal(report.sessions[1].cost, null);
  assert.equal(report.sessions[1].priced, false);
  assert.deepEqual(report.unpricedModels, ["vendor.unconfigured-model"]);
  assert.equal(report.categories[0].tokens, 3_000_000);
  assert.equal(report.categories[0].cost, 4);
  assert.equal(report.categories[0].unpricedTokens, 2_000_000);
  assert.equal(report.categories[1].cost, 0);
  assert.equal(report.categories[1].unpricedTokens, 1_000_000);
});

test("collects recursive catalog children and tolerates missing child usage", () => {
  const face = (snapshot) => ({ getSnapshot: () => snapshot });
  const values = {
    lead: { title: "Lead session", model: { id: MODEL } },
    "child-a": {
      title: "Researcher",
      model: MODEL,
      tokenUsage: { totals: { outputTokens: 100_000 } },
      subagentCatalog: [{ id: "child-b", label: "Writer" }],
    },
    "child-b": { modelId: "vendor.unconfigured-model" },
  };
  const sessions = {
    binding(id) {
      assert.equal(id, "lead");
      return {
        session: {
          projections: {
            faceOf(key) {
              if (key === "tokenUsage") return face({ uncachedInputTokens: 1_000_000 });
              if (key === "subagentCatalog") {
                return face({ values: [
                  { id: "child-a", label: "Researcher" },
                  { id: "child-a", label: "Duplicate" },
                  { id: "external", label: "External", mode: "external" },
                ] });
              }
              return undefined;
            },
          },
        },
      };
    },
    manager: { projectionValues: (id) => values[id] },
    list: {
      getSnapshot: () => ({ byId: { "child-b": { displayTitle: "Writer session" } } }),
    },
  };

  const report = api.collectCostReport("lead", sessions);
  assert.deepEqual(report.sessions.map(({ id, name }) => ({ id, name })), [
    { id: "lead", name: "Lead session" },
    { id: "child-a", name: "Researcher" },
    { id: "child-b", name: "Writer session" },
  ]);
  assert.equal(report.totalUsd, 6);
  assert.equal(report.sessions[2].usageAvailable, false);
  assert.deepEqual(report.unpricedModels, ["vendor.unconfigured-model"]);
});

test("prices lastUsed on lead and child projections and reads direct head values", () => {
  const lastUsed = { provider: "amazon-bedrock", model: MODEL };
  const sessions = {
    binding: () => ({
      session: {
        getSnapshot: () => ({ modelSelection: { lastUsed } }),
        projections: {
          faceOf: (key) => key === "tokenUsage"
            ? { getSnapshot: () => ({ uncachedInputTokens: 1_000_000 }) }
            : { values: [{ id: "child", label: "Child from head values" }] },
        },
      },
    }),
    manager: {
      projectionValues: (id) => id === "child" ? {
        modelSelection: { lastUsed },
        tokenUsage: { totals: { outputTokens: 100_000 } },
      } : undefined,
    },
  };

  const report = api.collectCostReport("lead", sessions);
  assert.deepEqual(report.sessions.map(({ id, model, priced }) => ({ id, model, priced })), [
    { id: "lead", model: MODEL, priced: true },
    { id: "child", model: MODEL, priced: true },
  ]);
  assert.equal(report.sessions[1].name, "Child from head values");
  assert.equal(report.totalUsd, 6);
  assert.deepEqual(report.unpricedModels, []);
});

test("keeps an unknown lastUsed model unpriced", () => {
  const model = api.modelIdFrom({
    modelSelection: {
      lastUsed: { provider: "amazon-bedrock", model: "vendor.unknown-last-used" },
    },
  });
  const report = api.aggregateCost([
    { id: "lead", name: "Lead", model, usage: { uncachedInputTokens: 1_000_000 } },
  ]);

  assert.equal(model, "vendor.unknown-last-used");
  assert.equal(report.totalUsd, 0);
  assert.equal(report.sessions[0].priced, false);
  assert.equal(report.sessions[0].cost, null);
  assert.deepEqual(report.unpricedModels, ["vendor.unknown-last-used"]);
});

test("prices GLM-5.3 with cached categories and older GLM-5", () => {
  const usage = {
    uncachedInputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheReadTokens: 1_000_000,
    cacheWriteTokens: 1_000_000,
  };
  const report = api.aggregateCost([
    { id: "lead", name: "Lead", model: "global.zai.glm-5.3", usage },
    { id: "older", name: "Older", model: "zai.glm-5", usage },
  ]);

  assert.equal(report.totalUsd, 13.572);
  assert.equal(report.sessions[0].cost, 9.372);
  assert.equal(report.sessions[1].cost, 4.2);
  assert.deepEqual(report.unpricedModels, []);
});

test("renders a missing session as unavailable rather than inventing usage", () => {
  const report = api.collectCostReport("missing", {
    binding: () => undefined,
    manager: { projectionValues: () => undefined },
  });

  assert.equal(report.sessions.length, 1);
  assert.equal(report.sessions[0].usageAvailable, false);
  assert.equal(report.sessions[0].cost, null);
  assert.equal(report.totalUsd, 0);
  assert.deepEqual(report.unpricedModels, ["Model unavailable"]);
  assert.deepEqual(api.normalizeUsage({ uncachedInputTokens: -5, outputTokens: NaN }), {
    uncachedInputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
});

test("stops projection subscriptions and polling when the last listener leaves", async () => {
  let faceSubscriptions = 0;
  let managerSubscriptions = 0;
  let cleared = 0;
  let tick;
  let refreshes = 0;
  const unsubscribeFace = () => { faceSubscriptions -= 1; };
  const face = (snapshot) => ({
    getSnapshot: () => snapshot,
    subscribe: () => {
      faceSubscriptions += 1;
      return unsubscribeFace;
    },
  });
  const sessions = {
    binding: () => ({
      session: {
        projections: {
          faceOf: (key) => key === "tokenUsage"
            ? face({ uncachedInputTokens: 1_000_000 })
            : face([{ id: "child", label: "Child" }]),
        },
      },
    }),
    manager: {
      projectionValues: (id) => id === "child"
        ? { model: MODEL, tokenUsage: { outputTokens: 100_000 } }
        : { model: MODEL },
      subscribe: () => {
        managerSubscriptions += 1;
        return () => { managerSubscriptions -= 1; };
      },
    },
    refreshProjections: async () => { refreshes += 1; },
  };
  const timers = {
    setInterval: (callback, delay) => {
      assert.equal(delay, 5_000);
      tick = callback;
      return 42;
    },
    clearInterval: (id) => {
      assert.equal(id, 42);
      cleared += 1;
    },
  };
  const source = api.createCostSource("lead", sessions, timers);
  assert.equal(faceSubscriptions, 0);
  assert.equal(managerSubscriptions, 0);

  const unsubscribe = source.subscribe(() => {});
  await tick();
  assert.equal(refreshes, 1);
  assert.equal(source.getSnapshot().totalUsd, 6);
  assert.equal(faceSubscriptions, 2);
  assert.equal(managerSubscriptions, 1);

  unsubscribe();
  unsubscribe();
  assert.equal(faceSubscriptions, 0);
  assert.equal(managerSubscriptions, 0);
  assert.equal(cleared, 1);
});

test("registers the live card in the conversation input dock", () => {
  let slotName;
  let registration;
  const ctx = {
    sessions: {
      binding: () => ({
        session: {
          projections: {
            faceOf: (key) => ({
              getSnapshot: () => key === "tokenUsage"
                ? { uncachedInputTokens: 1_000_000 }
                : [],
            }),
          },
        },
      }),
      manager: { projectionValues: () => ({ model: MODEL }) },
    },
    slots: {
      inject(name, register) {
        slotName = name;
        register();
      },
      register(descriptor, component) {
        registration = { descriptor, component };
      },
    },
  };

  api.apply(ctx);
  assert.equal(slotName, "conversation.input.dock");
  assert.equal(registration.descriptor.name, "conversation.input.dock");
  assert.equal(registration.descriptor.id, "live-cost");
  assert.equal(typeof registration.component, "function");
  const props = registration.descriptor.inject("lead");
  assert.equal(props.source.getSnapshot().totalUsd, 4);
});

test("shows native session details, sources, and the estimate disclaimer", () => {
  const report = api.aggregateCost([
    { id: "lead", name: "Lead", model: MODEL, usageAvailable: true,
      usage: { uncachedInputTokens: 1_000_000 } },
    { id: "offline", name: "Offline child", model: MODEL,
      usageAvailable: false, usage: null },
    { id: "child", name: "Mystery child", model: "vendor.unknown",
      usageAvailable: false, usage: null },
  ]);
  report.updatedAt = 0;
  const tree = api.LiveCostDock({
    source: { getSnapshot: () => report, subscribe: () => () => {} },
  });
  const text = textOf(tree);

  assert.ok(findElement(tree, "details"));
  assert.ok(findElement(tree, "summary"));
  assert.match(text, /Per-session breakdown · 3 included/);
  assert.match(text, /Usage unavailable for 2 sessions/);
  assert.match(text, /Cost unavailable/);
  assert.match(text, /Unpriced: vendor\.unknown/);
  assert.match(text, /₹90\/USD/);
  assert.match(text, /Rates per 1M:/);
  assert.match(text, /Estimate only/);
});
