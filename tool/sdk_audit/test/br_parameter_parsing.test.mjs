import test from "node:test";
import assert from "node:assert/strict";
import { extractDocs } from "../docs.mjs";

const source = (text) => ({
  text,
  url: "https://example.invalid/sdk.js",
  sha256: "some-sha",
  kind: "document",
});

test("parameter lists with <br> are not flattened incorrectly", () => {
  const s = source(`<h2 id="Widget">Tmapv3.Widget</h2><h3>Constructor</h3><div><h4>Parameters</h4><ul>
    <li>parent {Object}<br>child {String}</li></ul></div>`);
  const d = extractDocs([s], { links: [] });
  // Currently, this likely flattens to "parent {Object} child {String}" and may not parse "child" correctly.
  // The goal is to have both "parent" and "child" as parameters.
  assert(d.rows.some((r) => r.id === "Tmapv3.Widget#constructor:parent"), "Has parent");
  assert(d.rows.some((r) => r.id === "Tmapv3.Widget#constructor:child"), "Has child");
});

test("untyped parameter", () => {
  const s = source(`<h2 id="Widget">Tmapv3.Widget</h2><h3>Constructor</h3><div><h4>Parameters</h4><ul>
    <li>minLat : 좌표</li></ul></div>`);
  const d = extractDocs([s], { links: [] });
  const param = d.rows.find((r) => r.id === "Tmapv3.Widget#constructor:minLat");
  assert.strictEqual(param.type, null, "Type should be null");
});
