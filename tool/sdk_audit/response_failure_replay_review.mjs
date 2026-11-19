import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual as same } from 'node:util';
import { ROOT, sha } from './common.mjs';
import { currentNativeAdapterEvidence } from './native_adapter_current_scope.mjs';

const TARGET = { code: 'tdata-next-responseFailure-observations-rejected', reason: 'library mismatch' };
const RECEIPT = { path: 'docs/sdk-audit/checkpoints/2026-11-19/typed-response-failure-three-platform.json.gz', sha256: '161d198cdda84f19f2c2f7334aed9968aefcc9e91ce3efff4391630be52e741f' };
const COLLECTOR = { path: 'tool/sdk_audit/tdata_next_adapter_observations.mjs', sha256: 'cf4e6a88745b5ded777a0ebc3a67ff1ce2df3a7a5b6bdf5db10a69b3af7d966a' };
const SCENARIO = { path: 'example/test_driver/bridge/tdata_response_failure.dart', sha256: '2d334c89372ad7fc1dd261669bb7f3b22f4d2722099dbe87f77e68be9dfab33a' };
const HISTORICAL = { commit: '100fbc26b2dae8b410e64fc362344021ec944f08', gitBlob: '2d763b752f8f630aecce4c588b2417789ec607a9', path: 'example/integration_test/tdata_response_failure_contracts.dart', sha256: 'bd4394fcf835e8635c663af9605a45a289911867a349fa448eb0153a5c33bfd8' };
const CASES = {
  'http200-object-error': ['poiRejected', 'aroundRejected', 'autoRejected', 'routeRejected'],
  'payload-error': ['poiRejected', 'autoRejected', 'routeRejected', 'rawRetained'],
  success: ['poiPreserved', 'autoPreserved', 'routePreserved'],
  'wrapper-failure': ['failedRejected', 'errorRejected', 'rawRetained'],
};
const CHECKS = {
  'http200-object-error': ['aroundHealthy', 'aroundHealthyRequest', 'aroundRejected', 'aroundRequest', 'autoHealthy', 'autoHealthyRequest', 'autoRejected', 'autoRequest', 'poiHealthy', 'poiHealthyRequest', 'poiRejected', 'poiRequest', 'routeHealthy', 'routeHealthyRequest', 'routeRejected', 'routeRequest'],
  'payload-error': ['autoRejected', 'poiRejected', 'rawRetained', 'rawUnchanged', 'routeRejected'],
  success: ['absentErrorPreserved', 'absentSuccessRejected', 'autoPreserved', 'nullErrorPreserved', 'nullSuccessRejected', 'poiPreserved', 'rawUnchanged', 'routePreserved'],
  'wrapper-failure': ['errorRejected', 'failedRejected', 'rawRetained', 'rawUnchanged'],
};
const BEFORE_FALSE = new Set(['http200-object-error.aroundRejected', 'http200-object-error.autoRejected', 'http200-object-error.poiRejected', 'http200-object-error.routeRejected', 'payload-error.autoRejected', 'payload-error.poiRejected', 'payload-error.routeRejected', 'success.absentSuccessRejected', 'success.nullSuccessRejected', 'wrapper-failure.errorRejected', 'wrapper-failure.failedRejected']);
const FILES = {
  before: { 'lib/src/services/tdata_protocol.dart': '59bd596717a61415f97c45dad603730eb26d189c71a569beeb1d65482fbcb278', 'lib/src/services/tdata_service.dart': '42c6bd3d5077bf8b7fe1827f24ca36f9a4d13d8cf6ade2ec004d6cc30a13f3b7' },
  after: { 'lib/src/services/tdata_protocol.dart': '8fbb7dd7adfcf6aa7f50ba4610590d1c3dcb433ff73b114c4d3ff3210018ddf4', 'lib/src/services/tdata_service.dart': '4ce92cab6a4c801f1aa16c518097f26646b3cdba09ef6219e662c3275b67dfa8' },
};
const TREES = { before: '3be5b483adc8205b48970ab3b2f38c115c649c976be69b37c1682a031932e4dc', after: '567018f8b3ec593aecc68ee36ce5e04e73667b52c97d34286d8efeadf668a869' };
const CORES = { 'documentation-host-example-core': '09557bf8f7cfd14ff4ea9cca226962469fa14208ef4af1ee6b2d3567798296f1', 'flutter-web-fixed-cdn-versioned-core': '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e' };
const BOOTSTRAP_CORE = 'bootstrap-cdn-versioned-core';
const JQUERY = 'f7f6a5894f1d19ddad6fa392b2ece2c5e578cbf7da4ea805b6885eb6985b6e3d';
const PLATFORMS = ['android', 'ios', 'web'];
const requireProof = condition => { if (!condition) throw Error('response failure replay evidence mismatch'); };
const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...expected].sort());
const readPinned = (root, binding) => { const bytes = fs.readFileSync(path.join(root, binding.path)); requireProof(sha(bytes) === binding.sha256); return bytes; };

function officialEvidence(official, manifest) {
  requireProof(official?.baseline === manifest.id && official.jquery === JQUERY && typeof official.browser === 'string' && official.browser.length > 0);
  requireProof(manifest.sources.filter(s => s.role === 'documentation-host-example-jquery' && s.sha256 === JQUERY).length === 1);
  requireProof(Array.isArray(official.records) && official.records.length === 2);
  const ids = ['poi-clean', 'poi-null', 'poi-object', 'poi-string', 'autocomplete-clean', 'autocomplete-null', 'autocomplete-object', 'autocomplete-string', 'route-clean', 'route-null', 'route-object', 'route-string', 'http400-object', 'empty'];
  for (const [role, digest] of Object.entries(CORES)) {
    requireProof(manifest.sources.filter(s => s.role === role && s.sha256 === digest).length === 1);
    const records = official.records.filter(r => r.role === role && r.core === digest);
    requireProof(records.length === 1);
    const { logs, requests } = records[0];
    requireProof(Array.isArray(logs) && Array.isArray(requests) && logs.length === ids.length && requests.length === ids.length);
    for (const id of ids) {
      const logsForId = logs.filter(x => x.id === id), reqsForId = requests.filter(x => x.id === id);
      requireProof(logsForId.length === 1 && reqsForId.length === 1);
      const log = logsForId[0], req = reqsForId[0], status = id === 'empty' ? 204 : id === 'http400-object' ? 400 : 200;
      requireProof(log.status === status && log.event === (id.endsWith('-string') || id === 'empty' ? 'Error' : 'Complete') && log.receiver === true && log.storedSameBody === true && /^[a-f0-9]{64}$/.test(log.bodySha256));
      requireProof(req.method === 'GET' && req.path === '/tmap/pois' && req.status === status);
    }
  }
  return { method: 'getPOIDataFromSearchJson', browser: official.browser, jquery: JQUERY, records: official.records, scope: official.scope };
}

/** Replay the one normalized diagnostic only when the pinned corrected product is present. */
export function reviewResponseFailureReplay({ issues, manifest, runtime, dart, libFingerprint, root = ROOT }) {
  const unchanged = { open: issues, resolved: [] };
  try {
    const matches = issues.filter(i => i?.code === TARGET.code);
    requireProof(matches.length === 1 && same(matches[0], TARGET));
    const current = currentNativeAdapterEvidence({ manifest, runtime, dart, libFingerprint, root });
    requireProof(current && libFingerprint?.files && libFingerprint.sha256 === sha(JSON.stringify(libFingerprint.files)));
    const script = runtime.networkScripts[0];
    const sources = manifest.sources.filter(s => s.url === script.url);
    requireProof(sources.length === 1 && sources[0].kind === BOOTSTRAP_CORE && sources[0].role === BOOTSTRAP_CORE
      && sources[0].sha256 === script.sha256 && sources[0].bytes === script.bytes && script.status === 200);
    for (const [file, digest] of Object.entries(FILES.after)) {
      requireProof(libFingerprint.files[file] === digest && sha(fs.readFileSync(path.join(root, file))) === digest);
    }
    readPinned(root, COLLECTOR); readPinned(root, SCENARIO);
    const receipt = JSON.parse(gunzipSync(readPinned(root, RECEIPT)));
    requireProof(receipt.schemaVersion === 1 && same(receipt.original, TARGET) && same(receipt.originalCases, CASES));
    requireProof(same(receipt.inputs, { collector: COLLECTOR, historicalFixture: HISTORICAL, publicScenario: SCENARIO }));
    requireProof(keys(receipt.runs, ['before', 'after']));
    for (const phase of ['before', 'after']) {
      requireProof(keys(receipt.runs[phase], PLATFORMS));
      for (const platform of PLATFORMS) {
        const run = receipt.runs[phase][platform];
        requireProof(run.platform === platform && run.phase === phase && run.status === (phase === 'before' ? 'FAIL' : 'PASS') && typeof run.device === 'string' && run.device.length > 0);
        requireProof(run.scenarioSha256 === SCENARIO.sha256 && run.libSourceTree === TREES[phase] && same(run.productFileHashes, FILES[phase]) && keys(run.checks, Object.keys(CHECKS)));
        for (const [group, names] of Object.entries(CHECKS)) {
          requireProof(keys(run.checks[group], names));
          for (const name of names) requireProof(run.checks[group][name] === !(phase === 'before' && BEFORE_FALSE.has(`${group}.${name}`)));
        }
        if (phase === 'after') requireProof(run.device === receipt.runs.before[platform].device);
      }
    }
    const official = officialEvidence(receipt.official, manifest);
    return { open: issues.filter(i => i !== matches[0]), resolved: [{
      original: matches[0], status: 'REVIEWED_CORRECTED_FIXED_COHORT_REPLAY',
      scope: 'Only the 14 historical responseFailure assertions on the fixed controlled cohort; the other 19 checks per platform are controls. No live server error or raw callback equivalence is claimed. Dart returns typed null or empty results while retaining raw data.',
      evidence: { checkpoint: RECEIPT, collector: COLLECTOR, historicalFixture: HISTORICAL, publicScenario: SCENARIO, currentRuntime: current,
        originalCases: CASES, productFileHashes: FILES, sourceTrees: TREES, runs: receipt.runs, official }
    }] };
  } catch { return unchanged; }
}
