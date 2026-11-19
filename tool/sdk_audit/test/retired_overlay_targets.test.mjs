import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { ROOT, fingerprint, sha } from "../common.mjs";
import {
  reviewRetiredOverlayTargets as review,
  validatePriorOverlayScenario,
} from "../retired_overlay_targets.mjs";
const shape = {
  code: "shape-observations-rejected",
  reason: "platform evidence unavailable",
};
const lifecycle = {
  code: "overlay-lifecycle-observations-rejected",
  reason: "baseline mismatch",
};
const other = { code: "unrelated", reason: "still open" };
const read = (file) => JSON.parse(fs.readFileSync(file));
const fixture = JSON.parse(
  gunzipSync(
    fs.readFileSync(
      new URL(
        "./fixtures/legacy_native_adapter_cases.json.gz",
        import.meta.url,
      ),
    ),
  ),
);
const manifest = read(
  path.join(
    ROOT,
    "tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json",
  ),
);
const libFingerprint = await fingerprint(path.join(ROOT, "lib"));
const input = () =>
  structuredClone({
    issues: [shape, lifecycle, other],
    manifest,
    runtime: fixture.runtime,
    dart: fixture.dart,
    libFingerprint,
  });
function rootWith(overrides) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retired-overlay-"));
  fs.cpSync(path.join(ROOT, "lib"), path.join(root, "lib"), {
    recursive: true,
  });
  function mirror(relativePath) {
    const source = path.join(ROOT, relativePath);
    const matchingOverrides = Object.keys(overrides).filter(
      (file) => file === relativePath || file.startsWith(relativePath + "/"),
    );
    if (!matchingOverrides.length) {
      fs.symlinkSync(source, path.join(root, relativePath));
      return;
    }
    if (matchingOverrides.includes(relativePath)) return;
    fs.mkdirSync(path.join(root, relativePath), { recursive: true });
    const children = new Set([
      ...(fs.existsSync(source) ? fs.readdirSync(source) : []),
      ...matchingOverrides.map(
        (file) => file.slice(relativePath.length + 1).split("/")[0],
      ),
    ]);
    for (const child of children) mirror(path.join(relativePath, child));
  }
  for (const directory of ["tool", "docs", "example", "assets"]) mirror(directory);
  mirror("pubspec.yaml");
  for (const [file, bytes] of Object.entries(overrides)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), bytes);
  }
  return root;
}
test("exact independent targets preserve other issues and observations", () => {
  const data = input(),
    copy = structuredClone(data),
    result = review(data);
  assert.deepEqual(data, copy);
  assert.deepEqual(
    result.resolved.map((data) => data.original),
    [shape, lifecycle],
  );
  assert.deepEqual(result.open, [other]);
  assert.deepEqual(result.resolved[0].evidence.absentMethods, [
    "setCircleRadius",
    "setCircleCenter",
    "setCircleVisible",
    "setPolygonVisible",
    "setPolylineVisible",
    "setRectangleVisible",
  ]);
  assert.deepEqual(result.resolved[1].evidence.absentMethods, [
    "setMarkerClustererAttached",
    "getInfoWindowAnchor",
    "setInfoWindowAnchor",
    "setInfoWindowOptions",
    "setInfoWindowBorder",
    "setInfoWindowRenderedBorder",
    "setInfoWindowAttached",
  ]);
  for (const resolution of result.resolved) {
    assert.match(resolution.scope, /All inventory statuses are preserved/);
    assert.match(resolution.scope, /open verification/);
  }
  for (const data of result.resolved) {
    assert.equal(data.status, "REVIEWED_OBSOLETE_AUDIT_TARGET");
    assert.equal(
      data.evidence.releaseArchive.sha256,
      "dae54a154deb0b979e27c18d7d49d00faedd93bc8dfff8c732f11438a7fbb056",
    );
    assert.equal(Object.hasOwn(data, "byContract"), false);
  }
  for (const target of [shape, lifecycle]) {
    const data = input();
    data.issues = [target, other];
    assert.deepEqual(
      review(data).resolved.map((result) => result.original),
      [target],
    );
    assert.deepEqual(review(data).open, [other]);
  }
});
test("changed or duplicated original rejects only its own target", () => {
  for (const target of [shape, lifecycle])
    for (const change of [
      (data) => ({ ...data, reason: "different" }),
      (data) => ({ ...data, extra: true }),
    ]) {
      const data = input();
      data.issues = data.issues.map((i) =>
        i.code === target.code ? change(i) : i,
      );
      const result = review(data);
      assert.deepEqual(result.open, [
        data.issues.find((i) => i.code === target.code),
        other,
      ]);
      assert.deepEqual(
        result.resolved.map((v) => v.original),
        [target === shape ? lifecycle : shape],
      );
    }
  for (const target of [shape, lifecycle]) {
    const data = input();
    data.issues.push({ ...target });
    const result = review(data);
    assert.equal(result.resolved.length, 1);
    assert.equal(
      result.resolved[0].original.code,
      target === shape ? lifecycle.code : shape.code,
    );
    assert.equal(result.open.filter((i) => i.code === target.code).length, 2);
  }
});
test("runtime, baseline, declarations and fingerprints fail closed", () => {
  const cases = {
    auth: (data) => (data.runtime.auth = "failed"),
    bootstrap: (data) =>
      (data.runtime.verifiedBootstrapDigest = "0".repeat(64)),
    evidence: (data) => (data.runtime.platformEvidence = {}),
    duplicateScript: (data) =>
      data.runtime.networkScripts.push({ ...data.runtime.networkScripts[0] }),
    unknown: (data) =>
      (data.runtime.networkScripts[0].url = "https://example.invalid/core"),
    fixedWeb: (data) =>
      (data.runtime.networkScripts[0].url = manifest.sources.find(
        (s) => s.role === "flutter-web-fixed-cdn-versioned-core",
      ).url),
    duplicateSource: (data) =>
      data.manifest.sources.push({
        ...data.manifest.sources.find(
          (s) => s.url === data.runtime.networkScripts[0].url,
        ),
      }),
    hash: (data) => (data.runtime.networkScripts[0].sha256 = "0".repeat(64)),
    manifest: (data) => data.manifest.sources.pop(),
    fingerprint: (data) => (data.libFingerprint.sha256 = "0".repeat(64)),
    stale: (data) => {
      data.libFingerprint.files["lib/src/tmap_controller.dart"] = "0".repeat(
        64,
      );
      data.libFingerprint.sha256 = sha(
        JSON.stringify(data.libFingerprint.files),
      );
    },
    declarations: (data) =>
      data.dart.rows.push({
        id: "TMapController.setCircleRadius",
        kind: "method",
        file: "lib/src/tmap_controller.dart",
      }),
    missingApi: (data) =>
      (data.dart.rows = data.dart.rows.filter(
        (result) => result.id !== "TMapController.addCircle",
      )),
  };
  for (const [name, change] of Object.entries(cases)) {
    const data = input();
    change(data);
    const result = review(data);
    assert.deepEqual(result.resolved, [], name);
    assert.deepEqual(result.open, data.issues, name);
  }
});
test("each restored old controller method fails closed", () => {
  const methods = [
    "setCircleRadius",
    "setCircleCenter",
    "setCircleVisible",
    "setPolygonVisible",
    "setPolylineVisible",
    "setRectangleVisible",
    "setMarkerClustererAttached",
    "getInfoWindowAnchor",
    "setInfoWindowAnchor",
    "setInfoWindowOptions",
    "setInfoWindowBorder",
    "setInfoWindowRenderedBorder",
    "setInfoWindowAttached",
  ];
  for (const name of methods) {
    const data = input();
    data.dart.rows.push({
      id: "TMapController." + name,
      kind: "method",
      file: "lib/src/tmap_controller.dart",
    });
    assert.deepEqual(review(data).resolved, [], name);
  }
});
test("each named released add or clear API remains required", () => {
  const names = [
    "addCircle",
    "clearCircle",
    "addPolygon",
    "clearPolygon",
    "addPolyline",
    "clearPolyline",
    "addRectangle",
    "clearRectangle",
    "addMarkerClusterer",
    "clearMarkerClusterer",
    "addInfoWindow",
    "clearInfoWindow",
    "clearAllInfoWindows",
  ];
  for (const name of names) {
    const data = input();
    data.dart.rows = data.dart.rows.filter(
      (row) => row.id !== `TMapController.${name}`,
    );
    assert.deepEqual(review(data).resolved, [], name);
  }
});

test("pinned prior scenario validates every recorded shape and cluster", () => {
  const file = path.join(
    ROOT,
    "docs/sdk-audit/checkpoints/2026-11-19/cluster-shape-pair.json.gz",
  );
  const bytes = fs.readFileSync(file);
  assert.equal(
    sha(bytes),
    "8c07ff2c506f136fb34afd10eaa0c644ad12825c33c07ea8d18abb4045bc0f37",
  );
  const scenario = JSON.parse(gunzipSync(bytes));
  assert.doesNotThrow(() => validatePriorOverlayScenario(scenario));
  for (const platform of ["web", "android", "ios"]) {
    for (const mutate of [
      (cluster) => {
        cluster.rawCount = 0;
      },
      (cluster) => {
        cluster.dartCount = 0;
      },
      (cluster) => {
        cluster.member_tap_count = 1;
      },
      (cluster) => {
        cluster.raw.members[0].id = "wrong";
      },
      (cluster) => {
        cluster.dart.markerIds[0] = "wrong";
      },
    ]) {
      const altered = structuredClone(scenario);
      mutate(altered[platform].cluster);
      assert.throws(() => validatePriorOverlayScenario(altered), platform);
    }
    for (const shapeName of ["polyline", "polygon", "circle", "rectangle"]) {
      for (const source of ["official", "dart"]) {
        for (const mutate of [
          (record) => {
            record.before.rendered = false;
          },
          (record) => {
            record.detached.rendered = true;
          },
          (record) => {
            record.after.rendered = false;
          },
          (record) => {
            record.before.sameMap = false;
          },
          (record) => {
            record.detached.sameMap = true;
          },
          (record) => {
            record.after.sameMap = false;
          },
          (record) => {
            record.detached.geometry = [];
          },
          (record) => {
            record.after.geometry = [];
          },
          (record) => {
            record.sameIdentity = !record.sameIdentity;
          },
        ]) {
          const altered = structuredClone(scenario);
          mutate(altered[platform].shapes[shapeName][source]);
          assert.throws(
            () => validatePriorOverlayScenario(altered),
            `${platform} ${shapeName} ${source}`,
          );
        }
      }
    }
  }
});
test("accepts exactly one pinned rotating bootstrap source", () => {
  for (const source of manifest.sources.filter(
    (s) => s.role === "bootstrap-cdn-versioned-core",
  )) {
    const data = input();
    data.runtime.networkScripts[0].url = source.url;
    assert.equal(review(data).resolved.length, 2, source.url);
  }
});
test("restored helpers and changed collectors are independent", () => {
  for (const [file, target] of [
    ["example/integration_test/shape_setter_contracts.dart", shape],
    ["example/integration_test/overlay_lifecycle_contracts.dart", lifecycle],
    ["docs/sdk-audit/reviews/overlay-lifecycle-source-review.json", lifecycle],
    ["tool/sdk_audit/shape_observations.mjs", shape],
    ["tool/sdk_audit/overlay_lifecycle_verification.mjs", lifecycle],
  ]) {
    const root = rootWith({ [file]: "restored or changed" });
    try {
      const result = review({ ...input(), root });
      assert.deepEqual(result.open, [target, other]);
      assert.deepEqual(
        result.resolved.map((data) => data.original),
        [target === shape ? lifecycle : shape],
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  for (const file of [
    "tool/sdk_audit/fixtures/actual-pub-0.1.1.tar.gz",
    "docs/sdk-audit/checkpoints/2026-11-19/cluster-shape-pair.json.gz",
    "docs/sdk-audit/checkpoints/2026-11-19/rejected-receipt-source-bindings.json.gz",
  ]) {
    const root = rootWith({ [file]: "changed" });
    try {
      assert.deepEqual(review({ ...input(), root }).resolved, []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  const root = rootWith({
    "lib/src/tmap_controller.dart":
      fs.readFileSync(path.join(ROOT, "lib/src/tmap_controller.dart"), "utf8") +
      "\n",
  });
  try {
    assert.deepEqual(review({ ...input(), root }).resolved, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("self-consistent fingerprints cannot hide restored or unknown current sources", () => {
  for (const [file, bytes] of [
    [
      "lib/src/overlays/restored.dart",
      "class Restored { void setCircleRadius() {} }",
    ],
    ["lib/src/overlays/unknown.dart", "class Unknown {}"],
  ]) {
    const root = rootWith({ [file]: bytes }),
      data = input();
    data.libFingerprint.files[file] = sha(bytes);
    data.libFingerprint.sha256 = sha(JSON.stringify(data.libFingerprint.files));
    try {
      assert.deepEqual(review({ ...data, root }).resolved, []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});
test("current authenticated original report targets match", () => {
  const raw = process.env.TMAP_AUDIT_RAW_OUT;
  const report = raw
    ? read(path.join(raw, "report.json"))
    : { issues: [shape, lifecycle, other], libFingerprint };
  const data = {
    issues: report.issues,
    manifest,
    runtime: raw ? read(path.join(raw, "runtime.json")) : fixture.runtime,
    dart: raw ? read(path.join(raw, "dart.json")) : fixture.dart,
    libFingerprint: report.libFingerprint,
  };
  const result = review(data);
  assert.deepEqual(
    result.resolved.map((result) => result.original),
    [shape, lifecycle],
  );
  assert.deepEqual(
    result.open,
    data.issues.filter(
      (i) => i.code !== shape.code && i.code !== lifecycle.code,
    ),
  );
});

test("self-consistent unrelated TData changes retain both scoped dispositions", () => {
  for (const file of [
    "lib/src/services/tdata_protocol.dart",
    "lib/src/services/tdata_service.dart",
    "lib/src/models/address_info.dart",
    "lib/src/models/route_info.dart",
    "lib/src/models/poi_item.dart",
  ]) {
    const bytes = fs.readFileSync(path.join(ROOT, file), "utf8") +
      "\nint _unrelatedTDataResultHelper(int value) => value + 1;\n";
    const root = rootWith({ [file]: bytes });
    const data = input();
    data.libFingerprint.files[file] = sha(bytes);
    data.libFingerprint.sha256 = sha(JSON.stringify(data.libFingerprint.files));
    // An unrelated public TData declaration can also change in a real inventory.
    data.dart.rows.push({ id: "TDataCoordinateResult.extra", kind: "method", file });
    try {
      const result = review({ ...data, root });
      assert.deepEqual(result.resolved.map((x) => x.original), [shape, lifecycle], file);
      assert.deepEqual(result.open, [other], file);
      assert.equal(result.resolved[0].evidence.currentLibFingerprintSha256, data.libFingerprint.sha256);
      assert.equal(result.resolved[0].evidence.scopedSources["assets/bridge/web.js"],
        sha(fs.readFileSync(path.join(root, "assets/bridge/web.js"))));
      const stale = input();
      assert.deepEqual(review({ ...stale, root }).resolved, [], file + " stale evidence");
      const dishonest = input();
      dishonest.libFingerprint.files[file] = "0".repeat(64);
      dishonest.libFingerprint.sha256 = sha(JSON.stringify(dishonest.libFingerprint.files));
      assert.deepEqual(review({ ...dishonest, root }).resolved, [], file + " mismatched bytes");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("self-consistent fingerprints cannot authorize changed overlay and bridge paths", () => {
  for (const file of [
    "lib/src/overlays/circle.dart",
    "lib/src/overlays/clusterer.dart",
    "lib/src/overlays/info_window.dart",
    "lib/src/tmap_controller.dart",
    "lib/src/web/tmap_web_bridge.dart",
    "lib/src/tmap.dart",
    "assets/bridge/mobile_overlays.js",
    "assets/bridge/web.js",
    "assets/bridge/shared.js",
  ]) {
    const bytes = fs.readFileSync(path.join(ROOT, file), "utf8") + "\n// changed\n";
    const root = rootWith({ [file]: bytes });
    const data = input();
    if (file.startsWith("lib/")) {
      data.libFingerprint.files[file] = sha(bytes);
      data.libFingerprint.sha256 = sha(JSON.stringify(data.libFingerprint.files));
    }
    try {
      assert.deepEqual(review({ ...data, root }).resolved, [], file);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("TData scope cannot hide a restored target, new export or changed overlay declarations", () => {
  const file = "lib/src/services/tdata_protocol.dart";
  const original = fs.readFileSync(path.join(ROOT, file), "utf8");
  for (const addition of [
    "\nvoid setCircleRadius() {}\n",
    "\nexport 'other.dart';\n",
    "\nclass Circle {}\n",
    "\nvoid addInfoWindow() {}\n",
  ]) {
    const bytes = original + addition;
    const root = rootWith({ [file]: bytes });
    const data = input();
    data.libFingerprint.files[file] = sha(bytes);
    data.libFingerprint.sha256 = sha(JSON.stringify(data.libFingerprint.files));
    try {
      assert.deepEqual(review({ ...data, root }).resolved, [], addition);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  for (const row of [
    { id: "Circle.extra", kind: "method", file },
    { id: "Other.addCircle", kind: "method", file },
    { id: "SdkMarkerClusterNative", kind: "class", file },
  ]) {
    const data = input();
    data.dart.rows.push(row);
    assert.deepEqual(review(data).resolved, [], row.id);
  }
  const data = input();
  data.dart.exportedFiles.push("lib/src/services/extra.dart");
  assert.deepEqual(review(data).resolved, []);
});
