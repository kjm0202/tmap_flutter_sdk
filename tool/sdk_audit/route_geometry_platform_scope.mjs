import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { ROOT, sha } from './common.mjs';

const DIR = 'docs/sdk-audit/checkpoints/2026-11-19';
const PLATFORM_CHECKPOINT = [`${DIR}/released-route-model-three-platform.json.gz`, 'e3f6a5a9884f8730b5fc5f0730ce49bc637f8e7ff9d58d3189e1de1b2428761c'];
const POSITIVE_CHECKPOINT = [`${DIR}/typed-response-positive-coordinate-replay.json.gz`, 'c3aaebbc0ac133296f80ac1be6158e535f2b777906e0c303ce98ceb2fe9deca3'];
const LIVE_CHECKPOINT = [`${DIR}/tdata-coordinate-three-platform-final.json.gz`, '3908df1ca0945a6a0ade744bad8536992c7ec3325402783a7f6e3bec34a9103b'];
const BASELINE = ['tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json', '49db8bbc0a8bc8c824974a6f38f86473281ad9597fba81de2c616a1ec947e4cd'];
const BOOTSTRAP_SHA = '784ee06ed3dc974cc9839f6302346bd60616209b4d8635e5372d93577c59f01e';
const CORE = { sha256: '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e', bytes: 1281499 };
const BOOTSTRAP_CORE = 'bootstrap-cdn-versioned-core';

const SAMPLES = 'example/test_driver/bridge/tdata_coordinate_samples.dart';
const ROUTE_INFO = 'lib/src/models/route_info.dart';
const TDATA_SERVICE = 'lib/src/services/tdata_service.dart';
// Each phase binds the source files independently measured in that phase.
const PHASES = {
    round8: { live: 'before', files: { [ROUTE_INFO]: '580ef713be665321429ad8df1e8582705156e4014c8eaefe01755bb5bb6fdd1a', [TDATA_SERVICE]: 'b2df638ea7fc4225710a8d91edefe9faf5d60631285d5027339e855f9e06f08d' } },
    corrected: { live: 'after', files: { [ROUTE_INFO]: '919a22b75206ac1d3495801315be3459dfa0c3799613b71db5e751cff596e1af', [TDATA_SERVICE]: '42c6bd3d5077bf8b7fe1827f24ca36f9a4d13d8cf6ade2ec004d6cc30a13f3b7' } },
    typedResponse: { files: {
        [ROUTE_INFO]: '919a22b75206ac1d3495801315be3459dfa0c3799613b71db5e751cff596e1af',
        'lib/src/models/poi_item.dart': '14890163bb8189d0167a926f68c5de8a4c6510533a31e16d969966b61424b80d',
        [TDATA_SERVICE]: '4ce92cab6a4c801f1aa16c518097f26646b3cdba09ef6219e662c3275b67dfa8',
        'lib/src/services/tdata_protocol.dart': '8fbb7dd7adfcf6aa7f50ba4610590d1c3dcb433ff73b114c4d3ff3210018ddf4',
    } },
};
const PLATFORMS = ['android', 'ios', 'web'];
const ROUTE_PATH = [[37, 127], [38, 128], [40, 130], [41, 131]];
const ROUTE_GUIDES = [[37, 127]];
const LIVE_ROUTE = { vertices: 94, expectedVertices: 94, guides: 7, expectedGuides: 7, joins: 5 };
const SAMPLE_NAMES = ["'routePath': _pairs(route.path)", "'routeGuides': _pairs(guides)", "'failures': failures", 'route.guidePoints', 'RouteInfo.fromJson(', 'TDATA_MODEL_REPLAY'];
const ROUTE_NAMES = ['class RouteInfo {', 'final List<LatLng> path;', 'final List<RouteGuidePoint> guidePoints;', 'factory RouteInfo.fromJson('];

const fail = (why) => { throw Error(why); };
const sameKeys = (o, keys) => o && typeof o === 'object' && isDeepStrictEqual(Object.keys(o).sort(), [...keys].sort());

function pinned(root, [file, digest]) {
    const bytes = fs.readFileSync(path.join(root, file));
    if (sha(bytes) !== digest) fail(`pin ${file}`);
    return bytes;
}

function verifyRuntime(manifest, runtime, root) {
    if (!isDeepStrictEqual(manifest, JSON.parse(pinned(root, BASELINE)))) fail('baseline');
    const { id, ...content } = manifest;
    if (sha(JSON.stringify(content)) !== id) fail('baseline id');
    const bootstrap = manifest.sources.filter(s => s.role === 'official-key-authenticated-bootstrap');
    if (bootstrap.length !== 1 || bootstrap[0].sha256 !== BOOTSTRAP_SHA || manifest.auth?.sha256 !== BOOTSTRAP_SHA) fail('bootstrap source');
    if (runtime?.mapReady !== true || runtime.auth !== 'script-executed' || runtime.verifiedBootstrapDigest !== BOOTSTRAP_SHA) fail('runtime auth');
    const scripts = runtime.networkScripts;
    if (!Array.isArray(scripts) || scripts.length !== 1) fail('network scripts');
    const [script] = scripts;
    if (script.status !== 200 || script.pinned !== true || script.classification !== 'pinned-core' || script.sha256 !== CORE.sha256 || script.bytes !== CORE.bytes) fail('core script');
    const core = manifest.sources.filter(s => s.url === script.url);
    if (core.length !== 1 || core[0].kind !== BOOTSTRAP_CORE || core[0].role !== BOOTSTRAP_CORE
        || core[0].sha256 !== script.sha256 || core[0].bytes !== script.bytes) fail('core source');
    return { baselineId: id, bootstrapSha256: BOOTSTRAP_SHA, core: { url: script.url, role: core[0].role, sha256: script.sha256, bytes: script.bytes, status: script.status } };
}

// Throws unless the runtime is the authenticated official one; callers must not catch and continue.
export { verifyRuntime as verifyAuthenticatedGeometryRuntime };

// Returns the one phase whose measured files equal both local bytes and libFingerprint.files.
function sourcePhase(root, libFingerprint) {
    const files = libFingerprint?.files;
    if (!files || typeof files !== 'object' || Array.isArray(files)) fail('lib fingerprint files');
    if (typeof libFingerprint.sha256 !== 'string' || libFingerprint.sha256 !== sha(JSON.stringify(files))) fail('lib fingerprint digest');
    const matches = Object.keys(PHASES).filter(p => Object.entries(PHASES[p].files).every(([f, h]) =>
        files[f] === h && fs.existsSync(path.join(root, f)) && sha(fs.readFileSync(path.join(root, f))) === h));
    if (matches.length !== 1) fail('source pair');
    const routeText = fs.readFileSync(path.join(root, ROUTE_INFO), 'utf8');
    if (!ROUTE_NAMES.every(n => routeText.includes(n))) fail('route property names');
    return matches[0];
}

// Match common.fingerprint's traversal and ordering, including every current lib file.
function localLibFiles(root, dir = 'lib') {
    const files = {};
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (['node_modules', '.dart_tool', '.cache'].includes(entry.name)) continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) Object.assign(files, localLibFiles(root, file));
        else if (entry.isFile()) files[file] = sha(fs.readFileSync(path.join(root, file)));
    }
    return files;
}

function readPositiveScope(root, libFingerprint, runtime, samplesSha256) {
    if (!isDeepStrictEqual(libFingerprint.files, localLibFiles(root))) fail('current lib fingerprint');
    const receipt = JSON.parse(gunzipSync(pinned(root, POSITIVE_CHECKPOINT)));
    const scope = 'Current released path/guide order in original historical geometry fixture, and live coordinate results from actual TData coordinate scenario after top-level error filtering.';
    if (!sameKeys(receipt, ['schema', 'scope', 'platforms']) || receipt.schema !== 1 || receipt.scope !== scope || !sameKeys(receipt.platforms, PLATFORMS)) fail('positive receipt');
    const sourceFiles = [
        'example/test_driver/bridge/scenarios.dart', 'example/test_driver/bridge/tdata_coordinate_poi.dart',
        'example/test_driver/bridge/tdata_coordinate_projection.dart', 'example/test_driver/bridge/tdata_coordinate_route.dart',
        SAMPLES, 'example/test_driver/bridge/tdata_coordinate_scenario.dart', ...Object.keys(PHASES.typedResponse.files),
    ];
    const sampleNames = ['TDATA_MODEL_REPLAY', 'TDATA_ROUTE_SAMPLE', 'TDATA_PROJECTED_SAMPLE', 'TDATA_POI_SAMPLE'];
    const platforms = {};
    for (const platform of PLATFORMS) {
        const r = receipt.platforms[platform];
        if (!sameKeys(r, ['status', 'platform', 'device', 'sourceHashes', 'samples']) || r.status !== 'PASS' || r.platform !== platform || typeof r.device !== 'string' || !r.device) fail(`${platform} positive receipt`);
        if (!sameKeys(r.sourceHashes, sourceFiles) || !sourceFiles.every(f => sha(fs.readFileSync(path.join(root, f))) === r.sourceHashes[f])
            || !Object.entries(PHASES.typedResponse.files).every(([f, h]) => r.sourceHashes[f] === h)
            || r.sourceHashes[SAMPLES] !== samplesSha256 || !sameKeys(r.samples, sampleNames)) fail(`${platform} positive sources`);
        const model = r.samples.TDATA_MODEL_REPLAY, route = r.samples.TDATA_ROUTE_SAMPLE;
        const projected = r.samples.TDATA_PROJECTED_SAMPLE, poi = r.samples.TDATA_POI_SAMPLE;
        if (model?.schemaVersion !== 1 || model.scope !== 'controlled-model-sample-no-network' || !isDeepStrictEqual(model.routePath, ROUTE_PATH)
            || !isDeepStrictEqual(model.routeGuides, ROUTE_GUIDES) || !isDeepStrictEqual(model.failures, [])) fail(`${platform} positive model`);
        if (route?.vertices !== 93 || route.expectedVertices !== route.vertices || route.guides !== 6 || route.expectedGuides !== route.guides
            || route.lineStrings !== 7 || route.joins !== route.lineStrings - 1 || route.emptyGuideNames !== 1) fail(`${platform} positive route`);
        for (const [kind, count, guides] of [['car', route.vertices, route.guides], ['walk', 199, 34]]) {
            const result = projected?.[kind], official = result?.official;
            if (result?.valid !== true || official?.valid !== true || result.projectedValues !== 0 || result.path !== count || official.path !== count
                || result.guides !== guides || official.guides !== guides || !Array.isArray(result.first) || result.first.length !== 2
                || !Array.isArray(official.first) || official.first.length !== 2 || ![...result.first, ...official.first].every(Number.isFinite)) fail(`${platform} ${kind} projection`);
        }
        if (poi?.rawRowCount !== 20 || poi.comparedRows !== poi.rawRowCount || poi.controlledMissingNoorCount !== poi.rawRowCount || poi.distinctlyDifferentPairs !== 11) fail(`${platform} positive poi`);
        platforms[platform] = { device: r.device, phase: 'typedResponse', outcome: r.status, routePath: model.routePath,
            routeGuides: model.routeGuides, failures: model.failures, sourceHashes: r.sourceHashes, samples: r.samples };
    }
    return { sourceGroup: 'typedResponse', hashes: { positiveCheckpoint: { file: POSITIVE_CHECKPOINT[0], sha256: POSITIVE_CHECKPOINT[1] },
        samples: { file: SAMPLES, sha256: samplesSha256 }, route: PHASES.typedResponse.files }, runtime, scope: receipt.scope, platforms };
}

export function readRouteGeometryPlatformScope({ root = ROOT, manifest, runtime, libFingerprint } = {}) {
    try {
        const runtimeScope = verifyRuntime(manifest, runtime, root);
        const phase = sourcePhase(root, libFingerprint);
        const routeHashes = PHASES[phase].files;

        const samplesBytes = fs.readFileSync(path.join(root, SAMPLES));
        const samplesSha256 = sha(samplesBytes);
        const samplesText = samplesBytes.toString('utf8');
        if (!SAMPLE_NAMES.every(n => samplesText.includes(n))) fail('sample property names');

        if (phase === 'typedResponse') return readPositiveScope(root, libFingerprint, runtimeScope, samplesSha256);

        const model = JSON.parse(gunzipSync(pinned(root, PLATFORM_CHECKPOINT)));
        const live = JSON.parse(gunzipSync(pinned(root, LIVE_CHECKPOINT)));
        if (model.schemaVersion !== 1 || !sameKeys(model.groups, ['round8', 'corrected']) || !sameKeys(model.groups[phase], PLATFORMS)) fail('model groups');
        const liveRuns = live.deviceRuns?.[PHASES[phase].live];
        if (!sameKeys(liveRuns, PLATFORMS)) fail('live runs');
        if (phase === 'corrected' && !isDeepStrictEqual(live.fixedProductFiles, routeHashes)) fail('live fixed files');

        const platforms = {};
        for (const platform of PLATFORMS) {
            const r = model.groups[phase][platform];
            const o = r?.observation;
            if (r.platform !== platform || r.phase !== phase || r.outcome !== 'PASS') fail(`${platform} receipt`);
            if (o?.schemaVersion !== 1 || o.scope !== 'controlled-model-sample-no-network' || !isDeepStrictEqual(o.routePath, ROUTE_PATH)
                || !isDeepStrictEqual(o.routeGuides, ROUTE_GUIDES) || !isDeepStrictEqual(o.failures, [])) fail(`${platform} observation`);
            if (r.sourceHashes?.[SAMPLES] !== samplesSha256 || Object.entries(routeHashes).some(([f, h]) => r.sourceHashes[f] !== h)) fail(`${platform} source hashes`);

            // Only the WGS route sample is used; the run outcome (FAIL before, from the
            // projected sample) is recorded as is and does not affect this facet.
            const run = liveRuns[platform];
            const wgs = run?.samples?.TDATA_ROUTE_SAMPLE;
            if (run.device !== r.device || !wgs || Object.entries(LIVE_ROUTE).some(([k, v]) => wgs[k] !== v)) fail(`${platform} live route`);
            platforms[platform] = {
                device: r.device,
                phase,
                outcome: r.outcome,
                routePath: o.routePath,
                routeGuides: o.routeGuides,
                failures: o.failures,
                sourceHashes: { [SAMPLES]: samplesSha256, ...routeHashes },
                live: {
                    run: PHASES[phase].live,
                    receiptSha256: run.receiptSha256,
                    sourceTree: run.sourceTree,
                    runOutcome: run.outcome,
                    sample: 'TDATA_ROUTE_SAMPLE',
                    route: Object.fromEntries(Object.keys(LIVE_ROUTE).map(k => [k, wgs[k]])),
                },
            };
        }

        return {
            sourceGroup: phase,
            hashes: {
                platformCheckpoint: { file: PLATFORM_CHECKPOINT[0], sha256: PLATFORM_CHECKPOINT[1] },
                liveCheckpoint: { file: LIVE_CHECKPOINT[0], sha256: LIVE_CHECKPOINT[1] },
                samples: { file: SAMPLES, sha256: samplesSha256 },
                route: routeHashes,
            },
            runtime: runtimeScope,
            scope: 'Released RouteInfo.fromJson path and guide points for one controlled no-network sample on android, ios and web, in the source phase of the local route files, plus that phase\'s live WGS TDATA_ROUTE_SAMPLE counts only. TDATA_PROJECTED_SAMPLE is not used and the live run outcome is recorded as observed. PoiItem is out of scope.',
            platforms,
        };
    } catch {
        return null;
    }
}
