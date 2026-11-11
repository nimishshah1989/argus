import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function parseInsertEntries(yaml) {
  const pattern = /^- insert:\r?\n {4}- id: ([^\r\n]+)\r?\n {6}name: '([^']+)'\r?$/gm;
  return [...yaml.matchAll(pattern)].map((match) => ({ id: match[1], name: match[2] }));
}

test("package ships the Cordis bundle insert required by the installer", () => {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const patch = readFileSync(new URL("../cordis.patch.yml", import.meta.url), "utf8");
  const inserts = parseInsertEntries(patch);

  assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(manifest.exports["./cordis.patch.yml"], "./cordis.patch.yml");
  assert.ok(manifest.files.includes("cordis.patch.yml"));
  assert.deepEqual(inserts, [{ id: "live-cost", name: "@argus/dsh-live-cost" }]);
  assert.equal(inserts[0].name, manifest.name);
});
