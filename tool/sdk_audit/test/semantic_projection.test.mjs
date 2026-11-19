import { test } from "node:test";
import assert from "node:assert";
import { projectSurface, compareSurfaces } from "../semantic_projection.mjs";

test("semantic_projection actual channel schema", () => {
  const report = {
    rows: [
      {
        id: "X#f",
        scope: "undocumented-review-required",
        kinds: ["method"],
        sourceNames: ["X#f"],
      },
      {
        id: "X#option:x",
        scope: "documented",
        kinds: ["option"],
        sourceNames: ["Y#option:x"],
      },
    ],
  };
  const docs = {
    rows: [
      {
        id: "Y#option:x",
        kind: "option",
        name: "x",
        type: "Number",
        default: 1,
      },
    ],
  };
  const ast = {
    rows: [{ id: "X#f", kind: "method", static: false, parameters: ["x"] }],
  };
  const runtime = {
    rows: [{ id: "X#f", kind: "method", valueType: "function" }],
  };

  const surfaces = projectSurface(report, { docs, ast, runtime });
  assert.ok(surfaces.length >= 1, "Should be nonempty");

  // Test detection of option type/default, method arity, added/removed IDs
  const prev = JSON.parse(JSON.stringify(surfaces));

  // Change docs.type/default independently
  const docs2 = JSON.parse(JSON.stringify(docs));
  docs2.rows[0].type = "String";
  docs2.rows[0].default = "a";

  const surfaces2 = projectSurface(report, { docs: docs2, ast, runtime });
  const diff = compareSurfaces(prev, surfaces2);
  assert.strictEqual(diff.changed.length, 1, "Should detect doc change");
  assert.strictEqual(diff.changed[0], "X#option:x");

  // Change ast.parameters
  const ast2 = JSON.parse(JSON.stringify(ast));
  ast2.rows[0].parameters = ["x", "y"];

  const surfaces3 = projectSurface(report, { docs, ast: ast2, runtime });
  const diff2 = compareSurfaces(prev, surfaces3);
  assert.strictEqual(diff2.changed.length, 1, "Should detect arity change");
  assert.strictEqual(diff2.changed[0], "X#f");

  // Test added/removed
  const report2 = { rows: [report.rows[0]] }; // Remove X#option:x
  const surfaces4 = projectSurface(report2, { docs, ast, runtime });
  const diff3 = compareSurfaces(prev, surfaces4);
  assert.strictEqual(diff3.removed.length, 1, "Should detect removed");
  assert.strictEqual(diff3.removed[0], "X#option:x");

  // Test reversing ordering
  const report3 = {
    rows: [
      {
        id: "X#option:x",
        scope: "documented",
        kinds: ["option"],
        sourceNames: ["Y#option:x"],
      },
      {
        id: "X#f",
        scope: "undocumented-review-required",
        kinds: ["method"],
        sourceNames: ["X#f"],
      },
    ],
  };
  const surfaces5 = projectSurface(report3, { docs, ast, runtime });
  const diff4 = compareSurfaces(surfaces, surfaces5);
  assert.strictEqual(diff4.added.length, 0);
  assert.strictEqual(diff4.removed.length, 0);
  assert.strictEqual(diff4.changed.length, 0);
});
