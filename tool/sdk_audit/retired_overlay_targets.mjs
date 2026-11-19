import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { isDeepStrictEqual as same } from "node:util";
import { ROOT, sha } from "./common.mjs";
import { currentNativeAdapterEvidence } from "./native_adapter_current_scope.mjs";
import { verifiedNativeAdapterArchive } from "./legacy_native_adapter_archive.mjs";
import { readTar } from "./release_rest_named_adapters.mjs";

const release = "tool/sdk_audit/fixtures/actual-pub-0.1.1.tar.gz";
const releaseSha =
  "dae54a154deb0b979e27c18d7d49d00faedd93bc8dfff8c732f11438a7fbb056";
const index =
  "docs/sdk-audit/checkpoints/2026-11-19/public-331-real-scenarios.json.gz";
const checkpoint =
  "docs/sdk-audit/checkpoints/2026-11-19/cluster-shape-pair.json.gz";
const checkpointSha =
  "8c07ff2c506f136fb34afd10eaa0c644ad12825c33c07ea8d18abb4045bc0f37";
const controller = "lib/src/tmap_controller.dart";
// These are source bytes on the reviewed overlay, map and bridge call paths.
// The five TData files are instead checked as part of the complete fingerprint
// and for export/overlay surface drift below. They are not accepted as evidence
// of overlay behavior. New files or changed retained files require review.
const tdataFiles = ["lib/src/models/address_info.dart", "lib/src/models/poi_item.dart", "lib/src/models/route_info.dart", "lib/src/services/tdata_protocol.dart", "lib/src/services/tdata_service.dart"];
const scopedSources = {
  "assets/bridge/mobile.js": "2515469fc9636d81f0701d9256f5100952af5084d7d1e0fda81267e719ef40f0",
  "assets/bridge/mobile_overlays.js": "2447b2e2c8c57d4eeaef387d14fa39d2f2bc39065b79ac63a35dec2ca53e8f67",
  "assets/bridge/mobile_tdata.js": "7cb0fa61b6a34bc5ec005bd7e9ad39f5609f8b49c0fe27d4f467b9455eba207b",
  "assets/bridge/shared.js": "e1c85c2c1a5abecac241d1b9c174cc7cbdbb1bce028758a295910da02e1917aa",
  "assets/bridge/web.js": "cb1212e1f5d70a0e9d9cbf003c8a1f9be55bd8993863f5c2e2fac94345fb5bca",
  "lib/src/auth/auth_repository.dart": "97962e2414471432a66f5b15adb194ac7c815c3eea0b045372d354c0d53d7470",
  "lib/src/bridge_assets.dart": "53df87d66cf26e1936282928e0f0474ff907bfe717dd27493c5fd532110d67dd",
  "lib/src/callbacks/callbacks.dart": "06aba194f1ba667d0c0ad28e29b3213226f4b7df007b65e4206ea97e0e4fe451",
  "lib/src/constants/control_position.dart": "61a0d2327d33b198651f4bedb6d1a5c7b1145bf4aada7b7cde812ab63062550a",
  "lib/src/constants/drag_type.dart": "cec95f5971c92800d8b3564e9c9b5f0d0805ebebd481deab480f147c7d6ab5e3",
  "lib/src/constants/html_wrapper.dart": "66c566c30e0143cb5fd555b1b36d6c607e36ee4b69e3182292d8bdfcc5091ded",
  "lib/src/constants/map_type.dart": "94cf2f231d5fd3dc002e3b64c16471a58274c929cd898ea13305fa4ca216e5fc",
  "lib/src/constants/zoom_type.dart": "bf6f6f2489b5b9b89af61de6ba7e983a2beb0c2722642de6d58d1505620947e1",
  "lib/src/models/auto_complete_item.dart": "9898e561a646970ce2788a4f65255b2fd6f67bba45eb3972806f3d14abb7d25f",
  "lib/src/models/lat_lng.dart": "a4090c4f582ae262ebda524ca65e7b65d6e4b4e6de4d807c287847905de13329",
  "lib/src/models/lat_lng_bounds.dart": "e597c773ddfc7ad9c42590f8256733e6ea05bd9b3ecf69f4d721a8e4f7c7df51",
  "lib/src/models/point.dart": "3dbaae48ae936e595f6aac30970fb0b031fd2dc2640aae0a05a0e874c798969a",
  "lib/src/models/size.dart": "786fd13910d3036b5d29c5c93ab697693732fba257644272f93d211837a4e5f6",
  "lib/src/overlays/base_draw.dart": "9305517b47ebc0146e0f9bf4b53f77be22d9c9c8dfb23e29353c898ba9a8feda",
  "lib/src/overlays/circle.dart": "27bb5bb801d789c3ea67bf0919ea64daee7b39e8600fec85ffc48d3d47608c70",
  "lib/src/overlays/clusterer.dart": "a718c805de6829d10d31d199b4b337be12dfc8bdaff5acb66dca9d9972fbef9a",
  "lib/src/overlays/custom_overlay.dart": "6790a0c15b4517ee5b6be9a224f9741c2f981c8ca7d0408e5de76be19d530469",
  "lib/src/overlays/info_window.dart": "53a5bb0c34cfd0745e6c40475c7b13dca13a37ea9c2234c0ccc0f0b0abc86a09",
  "lib/src/overlays/label.dart": "eead619bfd15d311d3ae5874b86834d77484e039e56e0454825f4b728fbc258d",
  "lib/src/overlays/marker.dart": "8dcb619d4586d49588cbdbdf9cd1e9ea256b87fd4ba136e23d89aa97f6f2973e",
  "lib/src/overlays/marker_icon.dart": "fab5d8f6e70bc4550742d14aa77aa8a11c24e58c669349c87bab4ea5612f21a0",
  "lib/src/overlays/polygon.dart": "c3e67da7f6312043759c16ebc4dc80a83e96512106679c65c01e52fe8395240a",
  "lib/src/overlays/polyline.dart": "77fb70d416fadbbe5ab4cb947996d036630cd1c037b3dc23332e08dcef73ec0f",
  "lib/src/overlays/rectangle.dart": "88e44473cef2010100753c04fdddb0df90fe435efa2a78ec36194fdc050a98e1",
  "lib/src/tmap.dart": "c25d3bc828e0fcb52fe4c9c2bf168e9bb14daf41c60533e4507b7995447be845",
  "lib/src/tmap_controller.dart": "bea92644449d4959bfcc46be9a31eaf038f5ea17bf43b93e294a81a022629ea7",
  "lib/src/utils/hex_color.dart": "274f385e28f0625649c8c800860711e1224e0fefe9711a28b51640d304ac006e",
  "lib/src/utils/overlay_snapshot.dart": "ada2ebda00124824aa67c495c16fa6355135be136d52b5a002a27edc6ec0f460",
  "lib/src/web/tmap_web_bridge.dart": "e3e36c1b3bbac1653c64b3824521703cb7c9ab542e6a1c66a9ccea1f7223a631",
  "lib/src/web/tmap_web_bridge_stub.dart": "34508f5b7888beaeb77aa1c6d45af00647b5d97a10bb6da6e631b918e01b9f01",
  "lib/src/web/tmap_web_loader.dart": "19dbb0e4ae97a2a608f4bc9e0151b3455f534090018f4601b1e24985f5ef3142",
  "lib/src/web/tmap_web_stub.dart": "1f014a3729626c1973c0e5c82444b49b10a58a790e3dbdc38126b43ecc3d1aa1",
  "lib/src/web/tmap_web_widget.dart": "ec4fd2bab98b4ec9b9cebe8c2bd9bf7ddcd7d32250d21c2a6890c26d3c1e3cea",
  "lib/tmap_flutter_sdk.dart": "0747c375871570528239315eb26ace78de0fca8d6f627d7a99a2f37884504bf0",
  "pubspec.yaml": "9c8831c86b6cae2fe37f3ccbce4d9bdad61ab9ec627df40e2da165138248372f",
};
const inventoryFixture = "tool/sdk_audit/test/fixtures/legacy_native_adapter_cases.json.gz";
const inventoryFixtureSha = "f76d14dc75bbaf89fae4ef00e946e00f4d43baaee92b8650a75254cc44ffa617";

const targets = [
  {
    code: "shape-observations-rejected",
    reason: "platform evidence unavailable",
    collector: "tool/sdk_audit/shape_observations.mjs",
    collectorSha:
      "8c63758e776a7529ef3587ebe88bc1fbb581ed3d645d3e1da5c088eb88343381",
    helper: "example/integration_test/shape_setter_contracts.dart",
    blob: "f052a761f2ffe4ebf817f3a0bc35f7002d263ae9",
    paths: [
      "example/integration_test/shape_setter_contracts.dart",
      "example/integration_test/live_map_test.dart",
      "example/integration_test/web_live_probe.dart",
    ],
    absent: [
      "setCircleRadius",
      "setCircleCenter",
      "setCircleVisible",
      "setPolygonVisible",
      "setPolylineVisible",
      "setRectangleVisible",
    ],
    present: [
      "addCircle",
      "clearCircle",
      "addPolygon",
      "clearPolygon",
      "addPolyline",
      "clearPolyline",
      "addRectangle",
      "clearRectangle",
    ],
    scope:
      "Only the historical 38-case setter helper receipt is retired; the six official shape setter contracts still have open verification. All inventory statuses are preserved.",
    rationale:
      "The helper requires six unreleased controller setters. Existing three-platform shape add/clear/readd results do not establish setter behavior or retained-object identity.",
  },
  {
    code: "overlay-lifecycle-observations-rejected",
    reason: "baseline mismatch",
    collector: "tool/sdk_audit/overlay_lifecycle_verification.mjs",
    collectorSha:
      "f71b3ed7536422a572057b868d1b8aa7112f64430bc720ef77c490508d8ef5b7",
    helper: "example/integration_test/overlay_lifecycle_contracts.dart",
    blob: "0803f087c7a5dadbb46730827201d8ab592ae154",
    extra: {
      "docs/sdk-audit/reviews/overlay-lifecycle-source-review.json":
        "77d566e5b8950c368eae0b90dbc545d61e9e46f1",
    },
    paths: [
      "example/integration_test/overlay_lifecycle_contracts.dart",
      "docs/sdk-audit/reviews/overlay-lifecycle-source-review.json",
    ],
    absent: [
      "setMarkerClustererAttached",
      "getInfoWindowAnchor",
      "setInfoWindowAnchor",
      "setInfoWindowOptions",
      "setInfoWindowBorder",
      "setInfoWindowRenderedBorder",
      "setInfoWindowAttached",
    ],
    present: [
      "addMarkerClusterer",
      "clearMarkerClusterer",
      "addInfoWindow",
      "clearInfoWindow",
      "clearAllInfoWindows",
    ],
    scope:
      "Only the historical cluster and InfoWindow lifecycle helper receipt is retired; the official cluster setMap and InfoWindow getAnchor and setBorder facets still have open verification. All inventory statuses are preserved.",
    rationale:
      "The helper requires unreleased attachment, anchor, options and border methods. Public add/clear/recreation does not establish same-object behavior, Zoom listener collateral, native errors or DOM and adapted border behavior.",
  },
];
const fail = (message) => {
  throw Error(message);
};
function pinned(root, file, digest) {
  const bytes = fs.readFileSync(path.join(root, file));
  if (sha(bytes) !== digest) fail(file);
  return bytes;
}
function libFiles(root) {
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(entryPath);
      else if (entry.isFile()) files.push(path.relative(root, entryPath));
      else fail("non-file library entry");
    }
  }
  walk(path.join(root, "lib"));
  return files.sort();
}

// The pinned artifact records actual states, not a sameGeometry field.
export function validatePriorOverlayScenario(scenario) {
  const platforms = ["web", "android", "ios"];
  const shapes = ["polyline", "polygon", "circle", "rectangle"];
  const expectedIds = ["m1", "m2", "m3"];
  for (const platform of platforms) {
    const result = scenario.verification.results[platform];
    if (
      result?.exit !== 0 ||
      result.clusterPass !== true ||
      result.shapeCount !== 4
    ) {
      fail(`scenario summary ${platform}`);
    }
    const cluster = scenario[platform]?.cluster;
    if (
      cluster?.rawCount !== 1 ||
      cluster.dartCount !== 1 ||
      cluster.member_tap_count !== 0 ||
      !same(
        cluster.raw?.members?.map((member) => member.id).sort(),
        expectedIds,
      ) ||
      !same(cluster.dart?.markerIds?.slice().sort(), expectedIds)
    )
      fail(`scenario cluster ${platform}`);

    for (const shape of shapes) {
      const records = scenario[platform]?.shapes?.[shape];
      let expectedGeometry = scenario.verification.shapeInputs[shape];
      if (shape === "polygon")
        expectedGeometry = [...expectedGeometry, expectedGeometry[0]];
      for (const [source, expectedIdentity] of [
        ["official", true],
        ["dart", false],
      ]) {
        const record = records?.[source];
        if (
          record?.sameIdentity !== expectedIdentity ||
          record.before?.rendered !== true ||
          record.before.sameMap !== true ||
          record.detached?.rendered !== false ||
          record.detached.sameMap !== false ||
          record.after?.rendered !== true ||
          record.after.sameMap !== true ||
          !same(record.before.geometry, expectedGeometry) ||
          !same(record.detached.geometry, record.before.geometry) ||
          !same(record.after.geometry, record.before.geometry)
        )
          fail(`scenario shape ${platform} ${shape} ${source}`);
      }
    }
  }
}

function proof(target, { manifest, runtime, dart, libFingerprint, root }) {
  if (runtime?.platformEvidence !== undefined)
    fail("platform evidence supplied");
  // Preserve the shared guard unchanged for all other diagnostics. Its whole
  // inventory pin is evaluated against its authenticated historical input;
  // the supplied current inventory is separately checked against the relevant
  // projection, including cross-file declarations, below.
  const baselineDart = JSON.parse(
    zlib.gunzipSync(pinned(root, inventoryFixture, inventoryFixtureSha)),
  ).dart;
  const current = currentNativeAdapterEvidence({
    manifest,
    runtime,
    dart: baselineDart,
    libFingerprint,
    root,
  });
  if (!current) fail("current scope");
  const script = runtime.networkScripts[0],
    matches = manifest.sources.filter((s) => s.url === script.url);
  if (
    matches.length !== 1 ||
    matches[0].kind !== "bootstrap-cdn-versioned-core" ||
    matches[0].role !== "bootstrap-cdn-versioned-core" ||
    matches[0].sha256 !== script.sha256 ||
    matches[0].bytes !== script.bytes
  )
    fail("bootstrap");
  const prior = verifiedNativeAdapterArchive(root)?.prior;
  if (
    !prior ||
    prior.oldBaseline !==
      "82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714" ||
    prior.baselineId !== manifest.id ||
    prior.coreSha256 !== current.coreSha256 ||
    prior.publishedArchiveSha256 !== releaseSha
  )
    fail("prior");
  const originals = prior.issues.filter((x) => x.code === target.code);
  if (originals.length !== 1) fail("original count");
  const original = originals[0];
  if (
    original.reportedReason !== target.reason ||
    original.file !== target.collector ||
    original.fileSha256 !== target.collectorSha ||
    !same(
      Object.keys(original.pathLiteralLineNumbers ?? {}).sort(),
      [...target.paths].sort(),
    )
  )
    fail("original binding");
  const retired = { [target.helper]: target.blob, ...target.extra };
  for (const [file, blob] of Object.entries(retired))
    if (
      !same(prior.sourceFiles[file], {
        publishedPackage: null,
        testedGitBlob: null,
        backupGitBlob: blob,
      }) ||
      fs.existsSync(path.join(root, file))
    )
      fail("retired source " + file);
  pinned(root, target.collector, target.collectorSha);
  const archive = readTar(zlib.gunzipSync(pinned(root, release, releaseSha))),
    archiveController = archive[controller]?.toString("utf8");
  if (
    !archiveController ||
    sha(archive[controller]) !==
      "7781861f2084fa9b0358c8336ee5f60687171275ac29b67498675b542cf8882e"
  )
    fail("controller");
  for (const file of Object.keys(retired))
    if (archive[file]) fail("released helper");
  const rows = JSON.parse(
    zlib.gunzipSync(pinned(root, index, current.releaseIndexSha256)),
  ).rows;
  if (rows.length !== 331) fail("index");
  const files = libFingerprint?.files ?? {};
  if (
    sha(JSON.stringify(files)) !== libFingerprint.sha256 ||
    !same(Object.keys(files).sort(), libFiles(root)) ||
    !same(Object.keys(files).sort(),
      [...Object.keys(scopedSources).filter((f) => f.startsWith("lib/")), ...tdataFiles].sort())
  )
    fail("fingerprint");
  const texts = Object.entries(files).map(([file, digest]) =>
    pinned(root, file, digest).toString("utf8"),
  );
  for (const [file, digest] of Object.entries(scopedSources)) {
    if (file.startsWith("lib/") && files[file] !== digest) fail("scope fingerprint " + file);
    pinned(root, file, digest);
  }
  if (!Array.isArray(dart?.rows) || !same(dart.issues, []) ||
      !Array.isArray(dart.exportedFiles) ||
      !same([...dart.exportedFiles].sort(), [...baselineDart.exportedFiles].sort()))
    fail("current inventory");
  const absentAdapters = ["SdkHtmlNative", "SdkUtilitiesNative", "SdkVsmControlsNative",
    "SdkVisualizationNative", "SdkDrawingNative", "SdkMarkerClusterNative", "SdkNativeEvents"];
  if (dart.rows.some((r) => absentAdapters.some((name) => r.id === name || r.id?.startsWith(name + ".")) ||
      r.id === "TMapController.sdkEvents")) fail("current adapter surface");
  const subjectNames = [...new Set(targets.flatMap((t) => [...t.absent, ...t.present]))];
  const retainedRows = baselineDart.rows.filter((r) => !tdataFiles.includes(r.file));
  const retainedOwners = new Set(retainedRows
    .map((r) => r.id.includes(".") ? r.id.split(".")[0] : null).filter(Boolean));
  const relevant = (r) => !tdataFiles.includes(r.file) ||
    retainedOwners.has(r.owner) || retainedOwners.has(r.id) ||
    retainedOwners.has(r.id?.split(".")[0]) || subjectNames.includes(r.name) ||
    subjectNames.some((name) => r.id === name || r.id?.endsWith("." + name));
  const projection = (rows) => rows.filter(relevant)
    .map((r) => [r.id, r.kind, r.file].join("\t")).sort();
  const actualProjection = projection(dart.rows);
  if (!same(actualProjection, projection(baselineDart.rows))) fail("overlay declarations");
  // The mutable TData sources cannot introduce another export/part or a named
  // implementation while supplying stale or incomplete inventory evidence.
  const forbidden = new RegExp("\\b(?:export|part|" + subjectNames.join("|") + ")\\b");
  const ownerDeclaration = new RegExp("\\b(?:class|mixin|enum|extension|typedef)\\s+(?:" + [...retainedOwners].join("|") + ")\\b");
  for (const file of tdataFiles) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    if (forbidden.test(source) || ownerDeclaration.test(source)) fail("TData overlay surface " + file);
  }
  for (const name of target.absent) {
    const word = new RegExp("\\b" + name + "\\b");
    if (
      word.test(archiveController) ||
      rows.some((r) => r.id === "TMapController." + name) ||
      dart.rows.some((r) => r.id === "TMapController." + name) ||
      texts.some((s) => word.test(s))
    )
      fail("restored method " + name);
  }
  const currentController = fs.readFileSync(
    path.join(root, controller),
    "utf8",
  );
  for (const name of target.present) {
    const declaration = new RegExp("\\bFuture<void>\\s+" + name + "\\s*\\(");
    if (
      !declaration.test(archiveController) ||
      !declaration.test(currentController) ||
      !rows.some((r) => r.id === "TMapController." + name) ||
      !dart.rows.some(
        (r) => r.id === "TMapController." + name && r.file === controller,
      )
    )
      fail("missing named API " + name);
  }
  const scenario = JSON.parse(
    zlib.gunzipSync(pinned(root, checkpoint, checkpointSha)),
  );
  validatePriorOverlayScenario(scenario);
  return {
    baselineId: manifest.id,
    coreSha256: script.sha256,
    bootstrapCore: {
      url: script.url,
      role: matches[0].role,
      verifiedBootstrapDigest: runtime.verifiedBootstrapDigest,
    },
    collector: { path: target.collector, sha256: target.collectorSha },
    backupCommit: prior.backupCommit,
    retiredSourceBlobs: retired,
    releaseArchive: {
      path: release,
      sha256: releaseSha,
      controller,
      controllerSha256:
        "7781861f2084fa9b0358c8336ee5f60687171275ac29b67498675b542cf8882e",
    },
    releaseIndex: { path: index, sha256: current.releaseIndexSha256 },
    baselinePublicDeclarationSha256: current.currentPublicDeclarationSha256,
    scopedPublicDeclarationSha256: sha(actualProjection.join("\n")),
    scopedSources: { ...scopedSources },
    inventoryBaseline: { path: inventoryFixture, sha256: inventoryFixtureSha },
    currentController: { path: controller, sha256: files[controller] },
    currentLibFingerprintSha256: libFingerprint.sha256,
    absentMethods: target.absent,
    presentMethods: target.present,
    priorScenario: {
      path: checkpoint,
      sha256: checkpointSha,
      scope:
        "Previously recorded identical shape and cluster inputs on web, android and ios. Official SDK shapes detach and reattach the retained object; released Dart add/clear/readd recreates it. These paths are not equivalent; cluster selection is a separate public callback observation.",
    },
  };
}
export function reviewRetiredOverlayTargets({
  issues,
  manifest,
  runtime,
  dart,
  libFingerprint,
  root = ROOT,
}) {
  let open = issues;
  const resolved = [];
  for (const target of targets) {
    const found = open.filter((i) => i.code === target.code);
    if (
      found.length !== 1 ||
      !same(found[0], { code: target.code, reason: target.reason })
    )
      continue;
    let evidence;
    try {
      evidence = proof(target, {
        manifest,
        runtime,
        dart,
        libFingerprint,
        root,
      });
    } catch {
      continue;
    }
    open = open.filter((i) => i !== found[0]);
    resolved.push({
      original: found[0],
      status: "REVIEWED_OBSOLETE_AUDIT_TARGET",
      scope: target.scope,
      rationale: target.rationale,
      evidence,
    });
  }
  return { open, resolved };
}
