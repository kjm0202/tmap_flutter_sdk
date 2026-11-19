import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAST } from "../ast.mjs";
import { sha } from "../common.mjs";
import { deriveAudit } from "../audit_artifacts.mjs";

const url = "https://example.test/official-core.js";
function extract(body) {
  const text = `Tmapv3.createNamespace("Tmapv3.shape.Example",function(){${body}}());`;
  return {
    text,
    result: extractAST({ url, text, sha256: sha(text), kind: "sdk" }),
  };
}
const candidates = (r) => r.rows.filter((x) => x.kind === "option-candidate");
const ids = (r) =>
  candidates(r)
    .map((x) => x.id.split(":").at(-1))
    .sort();

test("arguments forwarding to a private helper records exact chain and only input reads", () => {
  const { text, result } = extract(`
    var C=function(){this._shape_data={zIndex:0}; inner.setOptions.apply(this,arguments)};
    C.prototype.setColorOptions=function(t){inner.setOptions.apply(this,[t])};
    var inner={setOptions:function(t){if(t){if(t.paths) this.path=t.paths;
      if(t.zIndex) this._shape_data.zIndex=t.zIndex;
      t.writeOnly=1; t.counter++; delete t.deleted;
      var fallback={fallbackOnly:1}; this.value=fallback.fallbackOnly; this.x=t._internal;
    }}}; return C;`);
  assert.deepEqual(ids(result), ["paths", "zIndex"]);
  const row = candidates(result).find((r) => r.id.endsWith(":zIndex"));
  const ev = row.evidence[0],
    flow = ev.flow,
    step = flow.steps[0];
  assert.equal(ev.source, url);
  assert.equal(ev.sha256, sha(text));
  const slice = (x) => text.slice(x.start, x.end);
  assert.match(slice(flow.constructor), /^function\(\)/);
  assert.equal(slice(step.call), "inner.setOptions.apply(this,arguments)");
  assert.match(slice(step.target), /^setOptions:function\(t\)/);
  assert.equal(slice(step.formal), "t");
  assert.equal(slice(flow.read), "t.zIndex");
  assert(result.rows.some((r) => r.id.endsWith("@_shape_data.zIndex")));
});

test("formal arguments and bounded multi-hop helpers preserve the argument index", () => {
  const { result } =
    extract(`var C=function(ignore, options){h.first.call(this,options)};
    var h={first:function(x){h.second.apply(this,[1,x])},second:function(a,b){return b['color']}};return C;`);
  assert.deepEqual(ids(result), ["color"]);
  const flow = candidates(result)[0].evidence[0].flow;
  assert.equal(flow.argument.kind, "constructor-formal");
  assert.equal(flow.argument.index, 1);
  assert.deepEqual(
    flow.steps.map((s) => s.argumentIndex),
    [0, 1],
  );
});

test("every forwarded position retains its constructor origin and helper formal", () => {
  for (const [body, roots] of [
    [
      `var C=function(o){h.read(o,o)};var h={read:function(a,b){return [a.genuineA,b.genuineB]}};return C;`,
      [0, 0],
    ],
    [
      `var C=function(){h.read.apply(this,arguments)};var h={read:function(a,b){return [a.genuineA,b.genuineB]}};return C;`,
      [0, 1],
    ],
    [
      `var C=function(a,b){h.read.apply(this,[b,a])};var h={read:function(x,y){return [x.genuineA,y.genuineB]}};return C;`,
      [1, 0],
    ],
  ]) {
    const { text, result } = extract(body);
    assert.deepEqual(ids(result), ["genuineA", "genuineB"], body);
    for (const [i, row] of candidates(result)
      .sort((a, b) => a.id.localeCompare(b.id))
      .entries()) {
      const flow = row.evidence[0].flow,
        step = flow.steps[0];
      assert.equal(flow.argument.index, roots[i], body);
      assert.equal(step.argumentIndex, i, body);
      assert.equal(
        text.slice(step.formal.start, step.formal.end),
        i === 0
          ? body.includes("function(x,y)")
            ? "x"
            : "a"
          : body.includes("function(x,y)")
            ? "y"
            : "b",
      );
    }
  }
  const { result } = extract(
    `var C=function(a,b){h.read(a,b)};var h={read:function(x,y){return [x.shared,y.shared]}};return C;`,
  );
  assert.deepEqual(
    candidates(result)[0]
      .evidence.map((e) => e.flow.argument.index)
      .sort(),
    [0, 1],
  );
});

test("only statically unreachable branches and statements are skipped", () => {
  const helper = `var h={read:function(x){return x.probe}};return C;`;
  for (const statement of [
    `false && h.read(o)`,
    `true || h.read(o)`,
    `!true && h.read(o)`,
    `false ? h.read(o) : 0`,
    `true ? 0 : h.read(o)`,
    `if(false) h.read(o)`,
    `if(true) {} else h.read(o)`,
    `if(true) return; h.read(o)`,
    `if(false) {} else return; h.read(o)`,
    `if(flag) return; else return; h.read(o)`,
    `1 ?? h.read(o)`,
  ]) {
    const { result } = extract(`var C=function(o){${statement}};${helper}`);
    assert.deepEqual(ids(result), [], statement);
  }
  for (const statement of [
    `true && h.read(o)`,
    `false || h.read(o)`,
    `flag && h.read(o)`,
    `flag || h.read(o)`,
    `flag ? h.read(o) : 0`,
    `if(flag) h.read(o)`,
    `if(flag) return; h.read(o)`,
    `null ?? h.read(o)`,
    `flag ?? h.read(o)`,
  ]) {
    const { result } = extract(`var C=function(o){${statement}};${helper}`);
    assert.deepEqual(ids(result), ["probe"], statement);
    assert.equal(candidates(result)[0].kind, "option-candidate");
  }
  const { result } = extract(
    `var C=function(o){if(false) o={}; h.read(o)};${helper}`,
  );
  assert.deepEqual(ids(result), ["probe"]);
  for (const [guard, expected] of [
    ["false", ["probe"]],
    ["true", []],
    ["flag", []],
  ]) {
    const { result } = extract(
      `var C=function(o){h.read(o)};${helper.replace("return C;", "")} if(${guard}) h.read=function(){};return C;`,
    );
    assert.deepEqual(ids(result), expected, guard);
    if (guard !== "false")
      assert(
        result.issues.some(
          (i) => i.code === "constructor-option-flow-unresolved",
        ),
      );
  }
});

test("setter-only, unrelated locals, reassignment, shadowing and ambiguous dispatch do not forge constructor options", () => {
  const cases = [
    [
      `var C=function(){};C.prototype.setter=function(t){h.run.apply(this,[t])};var h={run:function(t){return t.setterOnly}};return C;`,
      null,
    ],
    [
      `var C=function(t){var local={forged:1};return local.forged};return C;`,
      null,
    ],
    [
      `var C=function(t){t={};h.run.call(this,t)};var h={run:function(o){return o.forged}};return C;`,
      "argument-binding-reassigned-or-shadowed",
    ],
    [
      `var C=function(t){var h={run:function(o){return o.forged}};h.run.call(this,t)};var h={run:function(o){return o.other}};return C;`,
      "ambiguous-helper-dispatch",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){o={};return o.forged}};return C;`,
      "argument-binding-reassigned-or-shadowed",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){return o.forged}};h.run=function(o){return o.other};return C;`,
      "unresolved-or-mutable-helper",
    ],
    [
      `var C=function(t){h[key].call(this,t)};var h={run:function(o){return o.forged}};return C;`,
      "ambiguous-helper-dispatch",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){return o[key]}};return C;`,
      "dynamic-option-read",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){o[key]=1;return o.forged}};return C;`,
      "dynamic-option-write",
    ],
    [
      `var C=function(){arguments[0]={};h.run.apply(this,arguments)};var h={run:function(o){return o.forged}};return C;`,
      "constructor-arguments-mutated",
    ],
    [
      `var C=function(t){h.run.call(this,t)};return C;var h={run:function(o){return o.forged}};`,
      "unresolved-or-mutable-helper",
    ],
    [
      `var C=()=>h.run.apply(this,arguments);var h={run:function(o){return o.forged}};return C;`,
      "ambiguous-constructor-binding",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){return o.forged}};var leaked=h.run;return C;`,
      "unresolved-or-mutable-helper",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){return o.forged}};C=function(){};return C;`,
      "ambiguous-constructor-binding",
    ],
    [
      `var C=function(){h.run(arguments)};var h={run:function(o){return o.forged}};return C;`,
      null,
    ],
    [
      `var C=function(t){if(false) h.run.call(this,t)};var h={run:function(o){return o.forged}};return C;`,
      null,
    ],
    [
      `var C=function(t){return;h.run.call(this,t)};var h={run:function(o){return o.forged}};return C;`,
      null,
    ],
    [
      `var C=function(t){t.forged=1;h.run.apply(this,arguments)};var h={run:function(o){return o.forged}};return C;`,
      "constructor-arguments-mutated",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){let x=o;x.forged=1;return o.forged}};return C;`,
      "option-object-escapes",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){external(0,[o]);return o.forged}};return C;`,
      "option-object-escapes",
    ],
    [
      `var C=function(t){h.run.call(this,t)};var h={run:function(o){function mutate(){o.forged=1}mutate();return o.forged}};return C;`,
      "option-object-escapes",
    ],
    [
      `var C=function(t){h.first.call(this,t)};var h={first:function(o){o.forged=1;h.second.call(this,o)},second:function(o){return o.forged}};return C;`,
      "mutated-options-forwarded",
    ],
    [
      `var C=function(t){[t]=[{}];h.run.call(this,t)};var h={run:function(o){return o.forged}};return C;`,
      "argument-binding-reassigned-or-shadowed",
    ],
  ];
  for (const [body, reason] of cases) {
    const { result } = extract(body);
    assert.deepEqual(ids(result), [], body);
    if (reason)
      assert(
        result.issues.some(
          (i) =>
            i.code === "constructor-option-flow-unresolved" &&
            i.reason === reason,
        ),
        body,
      );
  }
});

test("constructor candidate and internal state remain separate in actual reconciliation", () => {
  const { result: ast } = extract(
    `var C=function(){this._shape_data={zIndex:0};h.run.apply(this,arguments)};var h={run:function(o){return o.zIndex}};return C;`,
  );
  const { artifacts } = deriveAudit({
    manifest: {
      id: "test",
      sources: [{ kind: "sdk", url, sha256: "test" }],
      issues: [],
    },
    docs: { rows: [], issues: [], scriptReferences: [], documentCount: 0 },
    ast,
    runtime: {
      rows: [],
      aliases: {},
      issues: [],
      observations: [],
      engine: { rows: [] },
    },
    dart: { rows: [], issues: [] },
    mappings: {
      classCandidates: {},
      memberCandidates: {},
      documentAliases: {},
    },
    values: [],
    cases: [],
    prior: { rows: [], baselineId: "prior", sha256: "test" },
    startInputs: {},
    createdAt: "2026-11-19T00:00:00Z",
    libFingerprint: { files: {} },
    bridgeFingerprint: { files: {} },
  });
  const report = artifacts["report.json"];
  const row = report.rows.find(
    (r) => r.id === "Tmapv3.shape.Example#constructor:zIndex",
  );
  assert(row);
  assert.equal(row.scope, "undocumented-review-required");
  assert.equal(row.status, "unmapped");
  assert.deepEqual(row.dartCandidates, []);
  assert(row.evidence[0].flow.steps[0].formal);
  assert(
    report.rows.some((r) => r.id === "Tmapv3.shape.Example@_shape_data.zIndex"),
  );
});

test(
  "captured core: all analogous shape helpers and source spans",
  { skip: !process.env.TMAP_AUDIT_CORE },
  async () => {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(process.env.TMAP_AUDIT_CORE, "utf8");
    const manifest = JSON.parse(
      await readFile(
        new URL(
          "../baselines/production-2026-11-19-46fa62a7bb27.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const source = manifest.sources.find((s) => s.kind === "sdk");
    assert.equal(sha(text), source.sha256);
    const ast = extractAST({ ...source, text });
    const expected = {
      Shape: "width height zIndex",
      Polygon:
        "paths fillColor fillOpacity strokeColor strokeOpacity strokeWeight draggable zIndex map",
      Polyline:
        "path fillColor fillOpacity strokeColor strokeOpacity strokeWeight strokeStyle outline outlineColor outlineOpacity direction directionColor directionOpacity draggable zIndex map",
      Circle:
        "center radius fillColor fillOpacity strokeColor strokeOpacity strokeWeight draggable zIndex map",
      Rectangle:
        "bounds fillColor fillOpacity strokeColor strokeOpacity strokeWeight draggable zIndex map",
      GroundOverlay: "url bounds opacity map",
    };
    for (const [cls, fields] of Object.entries(expected)) {
      const owner = `Tmapv3.shape.${cls}`;
      const actual = candidates(ast).filter((r) => r.owner === owner);
      assert.deepEqual(
        actual.map((r) => r.id.split(":").at(-1)).sort(),
        fields.split(" ").sort(),
      );
      for (const row of actual)
        for (const ev of row.evidence) {
          assert.equal(ev.source, source.url);
          assert.equal(ev.sha256, source.sha256);
          const { constructor, steps, read } = ev.flow;
          assert.match(
            text.slice(constructor.start, constructor.end),
            /^function/,
          );
          assert.match(
            text.slice(steps[0].call.start, steps[0].call.end),
            /\.setOptions\.apply\(this,arguments\)/,
          );
          assert.match(
            text.slice(steps[0].target.start, steps[0].target.end),
            /^setOptions:function/,
          );
          assert.equal(
            text.slice(steps[0].formal.start, steps[0].formal.end),
            "t",
          );
          assert.equal(
            text.slice(read.start, read.end),
            `t.${row.id.split(":").at(-1)}`,
          );
        }
    }
  },
);

test(
  "captured example mirror retains the same 47 shape options",
  { skip: !process.env.TMAP_AUDIT_EXAMPLE_CORE },
  async () => {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(process.env.TMAP_AUDIT_EXAMPLE_CORE, "utf8");
    const manifest = JSON.parse(
      await readFile(
        new URL(
          "../baselines/production-2026-11-19-46fa62a7bb27.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const source = manifest.sources.find(
      (s) => s.kind === "documentation-host-example-core",
    );
    assert.equal(sha(text), source.sha256);
    const ast = extractAST({ ...source, kind: "sdk", text });
    const expected = {
      Shape: "width height zIndex",
      Polygon:
        "paths fillColor fillOpacity strokeColor strokeOpacity strokeWeight draggable zIndex map",
      Polyline:
        "path fillColor fillOpacity strokeColor strokeOpacity strokeWeight strokeStyle outline outlineColor outlineOpacity direction directionColor directionOpacity draggable zIndex map",
      Circle:
        "center radius fillColor fillOpacity strokeColor strokeOpacity strokeWeight draggable zIndex map",
      Rectangle:
        "bounds fillColor fillOpacity strokeColor strokeOpacity strokeWeight draggable zIndex map",
      GroundOverlay: "url bounds opacity map",
    };
    for (const [cls, fields] of Object.entries(expected)) {
      const actual = candidates(ast).filter(
        (r) => r.owner === `Tmapv3.shape.${cls}`,
      );
      assert.deepEqual(
        actual.map((r) => r.id.split(":").at(-1)).sort(),
        fields.split(" ").sort(),
      );
      for (const row of actual)
        for (const ev of row.evidence) {
          assert.equal(ev.source, source.url);
          assert.equal(ev.sha256, source.sha256);
          assert.equal(
            text.slice(ev.flow.read.start, ev.flow.read.end),
            `t.${row.id.split(":").at(-1)}`,
          );
        }
    }
  },
);

test("executed mutation controls never invent an input read", async () => {
  const vm = await import("node:vm");
  const controls = [
    ["for (o of other) {}", "", "OTHER"],
    ["for ({x:o} of [{x:other[0]}]) {}", "", "OTHER"],
    ["for (o in {replacement:1}) {}", "", null],
    ["var alias=o; alias.probe='CHANGED'", "", "CHANGED"],
    ["mutate(o)", "", "MUTATED"],
    ["var alias=o; mutate(alias)", "", "MUTATED"],
    ["h.mutate(o)", "mutate:function(x){x.probe='CHANGED'},", "CHANGED"],
    ["h[key](o)", "mutate:function(x){x.probe='CHANGED'},", "CHANGED"],
    ["[o.probe]=['CHANGED']", "", "CHANGED"],
    ["for (o.probe of ['CHANGED']) {}", "", "CHANGED"],
  ];
  for (const [before, extra, value] of controls) {
    const body = `var C=function(o){${before};this.value=h.read(o)};var h={${extra}read:function(o){return o.probe}};return C;`;
    const { text, result } = extract(body);
    const ctx = {
      Tmapv3: { createNamespace: (_, c) => (ctx.C = c) },
      other: [{ probe: "OTHER" }],
      key: "mutate",
      mutate(o) {
        o.probe = "MUTATED";
      },
    };
    vm.runInNewContext(text, ctx);
    assert.equal(new ctx.C({ probe: "CALLER" }).value ?? null, value, body);
    assert.deepEqual(ids(result), [], body);
  }
});

test("all undecidable call spans survive without a diagnostic cap", () => {
  const calls = Array.from({ length: 35 }, (_, i) => `host${i}(o)`);
  const { text, result } = extract(
    `var C=function(o){${calls.join(";")}};return C;`,
  );
  const issues = result.issues.filter(
    (i) => i.code === "constructor-option-flow-unresolved",
  );
  assert.equal(issues.length, calls.length);
  assert.deepEqual(
    issues.map((i) => text.slice(i.evidence.start, i.evidence.end)),
    calls,
  );
  assert(issues.every((i) => i.reason === "dynamic-or-external-dispatch"));
});

test("immutable helper bindings, argument cells and sibling effects", () => {
  const bodies = [
    `var C=function(o){h.read(o)};var h={read:function(o){return o.probe}};[h]=[{read:function(){}}];return C;`,
    `var C=function(o){h.read(o)};var h={read:function(o){return o.probe}};for(h in {}){}return C;`,
    `var C=function(o){h.read(o)};var h={read:function(o){return o.probe}};[C]=[function(){}];return C;`,
    `var C=function(o){mutate(o);h.read.apply(this,arguments)};var h={read:function(o){return o.probe}};return C;`,
    `var C=function(){arguments[0].probe=1;h.read.apply(this,arguments)};var h={read:function(o){return o.probe}};return C;`,
    `var C=function(o){h.read(o)};var h={read:function(o){for(o.probe of [1]){}return o.probe}};return C;`,
    `var C=function(o){h.read(o)};var h={mut:function(o){o.probe=1},read:function(o){h.mut(o);return o.probe}};return C;`,
    `var C=function(o){function change(){o.probe=1}change();h.read(o)};var h={read:function(o){return o.probe}};return C;`,
    `var C=function(o){h.read(o)};var h={read:function(o){return o.probe}};function change(){function unused(){var h}h.read=function(){}}change();return C;`,
  ];
  for (const body of bodies)
    assert.deepEqual(ids(extract(body).result), [], body);
  const benign = extract(
    `var C=function(o){h.read(o)};var h={mut:function(o){o.other=1},read:function(o){h.mut(o);this.x=doWork();return o.probe}};return C;`,
  );
  assert.deepEqual(ids(benign.result), ["probe"]);
});

test("source identities, scope, hashes, and proof spans remain isolated", () => {
  const a = extract(`var C=function(o){h.read(o)};return C;`);
  const b = extract(
    `var C=function(o){};var h={read:function(o){return o.probe}};return C;`,
  );
  const sources = [a, b].map(({ text }, i) => ({
    text,
    url: `https://example.test/${i}.js`,
    sha256: sha(text),
    kind: "sdk",
  }));
  assert.deepEqual(ids(extractAST(sources)), []);
  const c = extract(
    `var C=function(o){h.read(o)};var h={read:function(o){return o.probe}};return C;`,
  );
  const source = {
    text: c.text,
    url: "https://example.test/proof.js",
    sha256: sha(c.text),
    kind: "sdk",
  };
  const result = extractAST([sources[0], source]);
  const ev = candidates(result)[0].evidence[0];
  assert.equal(ev.source, source.url);
  assert.equal(ev.sha256, source.sha256);
  assert.equal(
    source.text.slice(ev.flow.read.start, ev.flow.read.end),
    "o.probe",
  );
  assert.equal(
    source.text.slice(ev.flow.steps[0].call.start, ev.flow.steps[0].call.end),
    "h.read(o)",
  );
});

test("source-local constructor summaries reject mutations, reassignment and shadowing", () => {
  const base = (body) =>
    `Tmapv3.createNamespace("Tmapv3.shape.Base",function(){var B=function(o){${body}};return B}());`;
  const use = (body) =>
    `Tmapv3.createNamespace("Tmapv3.shape.Derived",function(){var C=function(o){${body};h.read(o)};var h={read:function(o){return o.probe}};return C}());`;
  const check = (text) =>
    extractAST({ text, url, sha256: sha(text), kind: "sdk" });
  assert.deepEqual(
    ids(check(base("") + use("Tmapv3.shape.Base.call(this,o)"))),
    ["probe"],
  );
  assert.deepEqual(
    ids(check(base("o.probe=1") + use("Tmapv3.shape.Base.call(this,o)"))),
    [],
  );
  assert.deepEqual(
    ids(
      check(
        base("") +
          `Tmapv3.shape.Base=function(o){o.probe=1};` +
          use("Tmapv3.shape.Base.call(this,o)"),
      ),
    ),
    [],
  );
  assert.deepEqual(
    ids(
      check(
        base("") +
          `[Tmapv3.shape.Base]=[function(o){o.probe=1}];` +
          use("Tmapv3.shape.Base.call(this,o)"),
      ),
    ),
    [],
  );
  assert.deepEqual(
    ids(
      check(
        base("") +
          `Object.assign(Tmapv3.shape,{Base:function(o){o.probe=1}});` +
          use("Tmapv3.shape.Base.call(this,o)"),
      ),
    ),
    [],
  );
  assert.deepEqual(
    ids(
      check(
        base("") +
          `Tmapv3.shape.Base.call=function(_,o){o.probe=1};` +
          use("Tmapv3.shape.Base.call(this,o)"),
      ),
    ),
    [],
  );
  assert.deepEqual(
    ids(
      check(
        base("") +
          use(
            "var Tmapv3={shape:{Base:function(o){o.probe=1}}};Tmapv3.shape.Base.call(this,o)",
          ),
      ),
    ),
    [],
  );
});
