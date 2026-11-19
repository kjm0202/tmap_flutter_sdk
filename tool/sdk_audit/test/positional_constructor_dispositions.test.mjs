import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { positionalConstructorDispositions } from "../positional_constructor_dispositions.mjs";
import { extractAST } from "../ast.mjs";
import { positionalConstructorRuntimeEvidence } from "../positional_constructor_runtime.mjs";

const manifest = JSON.parse(
  fs.readFileSync(
    new URL(
      "../baselines/production-2026-11-19-46fa62a7bb27.json",
      import.meta.url,
    ),
  ),
);
const sdk = manifest.sources.find((x) => x.kind === "sdk");

let sourceText;
const sourcePath =
  process.env.TMAP_AUDIT_CORE ||
  new URL("../.cache/sources/" + sdk.sha256, import.meta.url);
try {
  sourceText = fs.readFileSync(sourcePath, "utf8");
} catch (e) {
  sourceText = null;
}

const runtime = {
  auth: "script-executed",
  verifiedBootstrapDigest:
    "784ee06ed3dc974cc9839f6302346bd60616209b4d8635e5372d93577c59f01e",
  networkScripts: [
    {
      url: "https://topopentile1.tmap.co.kr/scriptSDKV3/tmapjs3.min.js?version=20231206",
      sha256:
        "5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e",
      bytes: 1281499,
      status: 200,
      pinned: true,
      classification: "pinned-core",
    },
  ],
  aliases: {
    "Tmapv3.Point": "Tmapv3.base.Point",
    "Tmapv3.LatLng": "Tmapv3.base.LatLng",
  },
  instances: [
    { name: "Tmapv3.Point", status: "constructed" },
    { name: "Tmapv3.LatLng", status: "constructed" },
  ],
  observations: [
    {
      id: "point.getX",
      status: "observed",
      value: 1.25,
      before: [1.25, -2.5],
      after: [1.25, -2.5],
      sameIdentity: false,
      returnedObject: false,
    },
    {
      id: "point.getY",
      status: "observed",
      value: -2.5,
      before: [1.25, -2.5],
      after: [1.25, -2.5],
      sameIdentity: false,
      returnedObject: false,
    },
    {
      id: "latlng.lat",
      status: "observed",
      value: 37.5665,
      before: [37.5665, 126.978],
      after: [37.5665, 126.978],
      sameIdentity: false,
      returnedObject: false,
    },
    {
      id: "latlng.lng",
      status: "observed",
      value: 126.978,
      before: [37.5665, 126.978],
      after: [37.5665, 126.978],
      sameIdentity: false,
      returnedObject: false,
    },
  ],
};

test("positionalConstructorDispositions - negative: wrong manifest", () => {
  const result = positionalConstructorDispositions({
    manifest: { id: "wrong" },
    sources: [],
    ast: { issues: [] },
    runtime: {},
    issues: [{ code: "constructor-option-flow-unresolved" }],
  });
  assert.strictEqual(result.open.length, 1);
  assert.strictEqual(result.resolved.length, 0);
});

test("positionalConstructorDispositions - negative: missing source", () => {
  const result = positionalConstructorDispositions({
    manifest: {
      id: manifest.id,
      sources: [{ kind: "sdk", url: sdk.url, sha256: sdk.sha256 }],
    },
    sources: [],
    ast: { issues: [] },
    runtime: {},
    issues: [{ code: "constructor-option-flow-unresolved" }],
  });
  assert.strictEqual(result.open.length, 1);
  assert.strictEqual(result.resolved.length, 0);
});

test(
  "positionalConstructorDispositions - genuine capture",
  { skip: !sourceText },
  () => {
    const ast = extractAST([{ ...sdk, text: sourceText }]);
    const issues = ast.issues.filter(
      (i) => i.code === "constructor-option-flow-unresolved",
    );

    const result = positionalConstructorDispositions({
      manifest,
      sources: [{ ...sdk, text: sourceText }],
      ast,
      runtime,
      issues,
    });

    assert.strictEqual(
      result.resolved.length,
      5,
      "Should resolve 5 valid issues",
    );
    assert.strictEqual(result.open.length, 15, "Should leave 15 open issues");
  },
);

test("positionalConstructorRuntimeEvidence - positive and corruption tests", () => {
  const validEvidence = positionalConstructorRuntimeEvidence(
    runtime,
    "Tmapv3.base.Point",
    sdk.sha256,
    manifest,
  );
  assert.ok(validEvidence !== null);
  assert.strictEqual(validEvidence.observations.length, 2);

  // 2. Corruption: Swapped getter value
  const corruptRuntime = JSON.parse(JSON.stringify(runtime));
  corruptRuntime.observations[0].value = 999;
  const swappedEvidence = positionalConstructorRuntimeEvidence(
    corruptRuntime,
    "Tmapv3.base.Point",
    sdk.sha256,
    manifest,
  );
  assert.strictEqual(swappedEvidence, null);

  // 3. Corruption: Duplicate receipt
  const duplicateRuntime = JSON.parse(JSON.stringify(runtime));
  duplicateRuntime.observations.push(duplicateRuntime.observations[0]);
  const duplicateEvidence = positionalConstructorRuntimeEvidence(
    duplicateRuntime,
    "Tmapv3.base.Point",
    sdk.sha256,
    manifest,
  );
  assert.strictEqual(duplicateEvidence, null);

  // 4. Corruption: Coherently fabricated pair
  const fabricatedRuntime = JSON.parse(JSON.stringify(runtime));
  fabricatedRuntime.observations.forEach((o) => {
    if (o.id.startsWith("point.")) {
      o.before = [9, 8];
      o.after = [9, 8];
      if (o.id === "point.getX") o.value = 9;
      if (o.id === "point.getY") o.value = 8;
    }
  });
  const fabricatedEvidence = positionalConstructorRuntimeEvidence(
    fabricatedRuntime,
    "Tmapv3.base.Point",
    sdk.sha256,
    manifest,
  );
  assert.strictEqual(fabricatedEvidence, null);
});

test("positionalConstructorRuntimeEvidence - CDN and tampering coverage", () => {
  const fn = (r, m = manifest) =>
    positionalConstructorRuntimeEvidence(r, "Tmapv3.base.Point", sdk.sha256, m);

  // 1. Positive: Valid runtime
  for (const n of [1, 2, 3]) {
    const tileRuntime = JSON.parse(JSON.stringify(runtime));
    tileRuntime.networkScripts[0].url = tileRuntime.networkScripts[0].url.replace(
      "tile1",
      "tile" + n,
    );
    const result = fn(tileRuntime);
    assert.ok(result !== null, `Valid runtime for tile${n}`);
    assert.strictEqual(
      result.source.url,
      tileRuntime.networkScripts[0].url,
      `Returned source.url should match input tile${n}`,
    );
  }

  // 2. Tampered Auth
  assert.strictEqual(fn({ ...runtime, auth: "unverified" }), null);

  // 3. Tampered Bootstrap
  assert.strictEqual(
    fn({ ...runtime, verifiedBootstrapDigest: "fake" }),
    null,
  );

  // 4. Wrong URL
  const wrongUrlRuntime = {
    ...runtime,
    networkScripts: [
      {
        ...runtime.networkScripts[0],
        url: "https://example.invalid/core.js",
      },
    ],
  };
  assert.strictEqual(fn(wrongUrlRuntime), null);

  // 5. Negative: Duplicate loaded pinned-core entries
  const duplicateCoreRuntime = JSON.parse(JSON.stringify(runtime));
  duplicateCoreRuntime.networkScripts.push({
    ...duplicateCoreRuntime.networkScripts[0],
    url: "https://another.tmap.co.kr/js",
  });
  assert.strictEqual(fn(duplicateCoreRuntime), null);

  // 6. Negative: Same-URL manifest pin with wrong role
  const wrongRoleManifest = JSON.parse(JSON.stringify(manifest));
  const sdkSource = wrongRoleManifest.sources.find((x) => x.url === runtime.networkScripts[0].url);
  sdkSource.role = 'other';
  assert.strictEqual(fn(runtime, wrongRoleManifest), null);
});

test(
  "positionalConstructorDispositions - genuine captured AST variations",
  { skip: !sourceText },
  () => {
    const ast = extractAST([{ ...sdk, text: sourceText }]);
    const issues = ast.issues.filter(
      (i) => i.code === "constructor-option-flow-unresolved",
    );
    const profile = {
      manifest,
      sources: [{ ...sdk, text: sourceText }],
      ast,
      runtime,
      issues,
    };

    // 1. Duplicate AST on ONE LatLng site
    const latLngIssues = issues.filter((i) => i.owner === "Tmapv3.base.LatLng");
    // Add duplicate to ast.issues
    const dupASTIssues = [...ast.issues, latLngIssues[0]];
    const resultDup = positionalConstructorDispositions({
      ...profile,
      ast: { ...ast, issues: dupASTIssues },
    });
    assert.strictEqual(
      resultDup.resolved.length,
      4,
      "Should resolve 4 issues (duplicate AST)",
    );

    // 2. Missing LatLng alias (5->1 for missing LatLng alias)
    const runtimeNoLatLngAlias = {
      ...runtime,
      aliases: { "Tmapv3.Point": "Tmapv3.base.Point" },
    };
    const resultNoAlias = positionalConstructorDispositions({
      ...profile,
      runtime: runtimeNoLatLngAlias,
    });
    assert.strictEqual(
      resultNoAlias.resolved.length,
      1,
      "Should resolve 1 issue (missing LatLng alias)",
    );
  },
);
