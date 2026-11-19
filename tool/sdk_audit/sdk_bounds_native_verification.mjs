import {parsePlatformMarkerRows,platformLogPassed} from './platform_log_markers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';
import { ROOT, sha } from './common.mjs';
import { capturePlatformInputs, validatePlatformRunManifest } from './platform_run_binding.mjs';

// A bounded observation checker, not a contract-promotion gate. In
// particular, callable equality is not a digest of the SDK loaded on a device.
const SDK = '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const files = {
  fixture: ['docs/sdk-audit/reviews/sdk-bounds-native-input-fixture.json', 'cbc5a25dc950145a5afa5025552d94850061710bbcb00a2c0c9b561278118d51'],
  source: ['docs/sdk-audit/reviews/sdk-bounds-native-source-evidence.json', '49b1af529b72d59d00164c149ddb955857020309cf21ed7b00eb702cdd45c588'],
  probe: ['docs/sdk-audit/reviews/sdk-bounds-native-method-source.mjs', '25695a3fa699aa14e616aaa9fd02653f6cd1be04d0b80df8c1569f9388903d43'],
  helper: ['example/integration_test/sdk_bounds_native_contracts.dart', '8cadedb5184b4f9522dac47236e9b97e0c5f1050282fa0d953475f0b446c37c2'],
};
const methods = ['getWidth', 'getHeight', 'toString'];
const eqKeys = (x, keys) => x && typeof x === 'object' && !Array.isArray(x) && same(Object.keys(x).sort(), [...keys].sort());
const valueValid = (method, v) => method === 'toString' ? typeof v === 'string' :
  (typeof v === 'number' && Number.isFinite(v)) ||
  (eqKeys(v, ['special']) && ['NaN', 'Infinity', '-Infinity', '-0'].includes(v.special));

function references(read) {
  const content = {};
  for (const [key, [file, digest]] of Object.entries(files)) {
    const bytes = read(path.join(ROOT, file));
    if (sha(bytes) !== digest) throw Error(`${key} hash mismatch`);
    content[key] = bytes;
  }
  const fixture = JSON.parse(content.fixture), ref = JSON.parse(content.source);
  const sdk = read(path.join(ROOT, `tool/sdk_audit/.cache/sources/${SDK}`));
  if (sha(sdk) !== SDK || fixture.status !== 'OPEN' || Object.keys(fixture.scenarios).length !== 18 ||
      ref.status !== 'OPEN' || ref.sdkSha256 !== SDK || ref.probe?.sha256 !== files.probe[1] ||
      ref.probe?.file !== files.probe[0] || ref.observation?.status !== 'observed' ||
      !same(ref.observation.aliases, {bounds:true,latLng:true})) throw Error('reference metadata');
  const entries = ref.sourceEvidence, callables = ref.observation.methods;
  if (!Array.isArray(entries) || entries.length !== 15 || Object.keys(callables).length !== 15 ||
      new Set(entries.map(e => e.id)).size !== 15) throw Error('callable reference count');
  const text = sdk.toString('utf8');
  for (const e of entries) {
    const excerpt = text.slice(e.start, e.end), start = excerpt.indexOf('function');
    if (e.sha256 !== SDK || excerpt !== e.excerpt || start < 0 || excerpt.slice(start) !== callables[e.id])
      throw Error(`source span mismatch: ${e.id}`);
  }
  return {fixture: fixture.scenarios, observation: ref.observation};
}

export function compareSdkBoundsNative({source, rows}, {read = fs.readFileSync} = {}) {
  const issues = [], missing = [];
  let ref;
  try { ref = references(read); } catch (e) { issues.push(`reference: ${e.message}`); }
  if (!ref) return {status:'MISMATCH', count:Array.isArray(rows) ? rows.length : 0, issues, missing};
  if (!source || source.id !== 'sdk-bounds-native:callable-sources' || source.expectedSdkSha256 !== SDK ||
      source.sdkDigestMeasurement !== 'not measured by this helper' || !same(source.observation, ref.observation))
    issues.push('callable source observation');
  const expected = new Map(Object.entries(ref.fixture).flatMap(([scenario, state]) =>
    methods.map(method => [`sdk-bounds-native:${scenario}:${method}`, {scenario, method, state}])));
  const found = new Map();
  if (!Array.isArray(rows)) rows = [];
  for (const row of rows) {
    if (!row || !expected.has(row.id)) { issues.push(`unexpected row: ${row?.id}`); continue; }
    if (found.has(row.id)) { issues.push(`duplicate row: ${row.id}`); continue; }
    found.set(row.id, row);
  }
  for (const [id, {scenario, method, state}] of expected) {
    const row = found.get(id);
    if (!row) { missing.push(id); continue; }
    const fail = reason => issues.push(`${id}: ${reason}`);
    if (row.scenario !== scenario || row.method !== method || row.expectedSdkSha256 !== SDK ||
        row.sdkDigestMeasurement !== 'not measured by this helper' || !same(row.before, state) || !same(row.after, state)) fail('input or state');
    const n = row.native, d = row.controller;
    const neMissing = state.northEast.kind !== 'value', swMissing = state.southWest.kind !== 'value';
    if (method !== 'toString' && (neMissing || swMissing)) {
      const operation = neMissing && method === 'getWidth' ? 'getNorthEast' : 'getNorthWest';
      const corner = neMissing ? 'northEast' : 'southWest';
      if (!same(n, {status:'threw', errorType:'TypeError'}) ||
          !same(d, {status:'threw', errorType:'SdkBoundsMissingCornerException', operation, corner})) fail('exception adaptation');
    } else if (!eqKeys(n, ['status','value','repeat']) || !eqKeys(d, ['status','value','repeat']) ||
        n.status !== 'observed' || d.status !== 'observed' || !valueValid(method, n.value) ||
        !same(n.value, n.repeat) || !same(n.value, d.value) || !same(d.value, d.repeat)) fail('result or repeat');
  }
  return {status:issues.length ? 'MISMATCH' : missing.length ? 'INCOMPLETE' : 'BOUNDED_MATCH',
    count:rows.length, issues, missing, scope:'54 fixed typed snapshots: delegate compared exactly to SDK in the same runtime; no contract promotion or device SDK-byte measurement.'};
}

/** Collect run-bound observations; this never changes a contract's status. */
export function collectSdkBoundsNativeObservations({runtime, manifest, libFingerprint, root = ROOT}) {
  try {
    const fail = message => { throw Error(message); };
    const baselineId = '82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
    const evidence = runtime?.platformEvidence;
    if (manifest?.id !== baselineId || !manifest.sources?.some(s => s.kind === 'sdk' && s.sha256 === SDK)) fail('baseline or SDK mismatch');
    if (!evidence || !same(evidence.libFingerprint, libFingerprint)) fail('platform evidence or library fingerprint mismatch');
    const current = capturePlatformInputs(root);
    if (!same(current, {libFingerprint, inputs:evidence.inputs})) fail('current source inputs do not match evidence');
    const records = Array.isArray(evidence.records) ? evidence.records.filter(r => r.kind === 'integration') : [];
    const platforms = ['android','ios','web'];
    if (records.length !== 3 || platforms.some(p => records.filter(r => r.platform === p).length !== 1)) fail('missing or duplicate integration records');
    const output = Object.fromEntries(methods.map(method => [`Tmapv3.base.LatLngBounds#${method}`, {
      status:'observed-not-verified', baselineId, expectedSdkSha256:SDK,
      sdkDigestMeasurement:'not measured by helper', libFingerprintSha256:libFingerprint.sha256,
      fixture:{file:files.helper[0], sha256:files.helper[1]}, platforms:{},
      limitations:[
        'Asynchronous controller reconstructs a typed numeric snapshot; aliases, accessors, listeners and prototype changes are not represented.',
        'Missing-corner JavaScript TypeError is adapted to SdkBoundsMissingCornerException.',
        'Synchronous pure-Dart distance math and formatting can differ from JavaScript; these observations cover only native delegation.',
        'Only callable source text is observed on each platform; device SDK bytes and private closures are not measured.',
        'Eighteen selected cases per method and platform are observations, not full-domain verification or contract status promotion.'
      ]
    }]));
    const readRef = p => fs.readFileSync(path.join(root, path.relative(ROOT, p)));
    for (const rec of records) {
      const expectedLog = `docs/sdk-audit/platform-logs/${rec.platform === 'web' ? 'web-final.log' : rec.platform + '-complete.log'}`;
      if (rec.passed !== true || rec.file !== expectedLog || rec.run?.file !== rec.file + '.run.json') fail('invalid integration or run record');
      const load = (file, expected) => {
        const bytes = fs.readFileSync(path.join(root, file));
        if (!/^[a-f0-9]{64}$/.test(expected || '') || sha(bytes) !== expected) fail('log or run digest mismatch');
        return bytes.toString('utf8');
      };
      const log = load(rec.file, rec.sha256), lines = log.split('\n');
      const run = JSON.parse(load(rec.run.file, rec.run.sha256));
      if (run.sanitizedLogSha256 !== rec.sha256 || run.exitCode !== 0 || run.signal !== null) fail('invalid successful run binding');
      const {sanitizedLogSha256, ...rawRun} = run;
      // Raw bytes remain private. Their recorded digest cannot be recomputed
      // from the sanitized log here; the recorder validates the raw input.
      validatePlatformRunManifest(rawRun, {platform:rec.platform,kind:'integration',inputs:current,rawLogSha256:rawRun.rawLogSha256});
      if (!platformLogPassed(log.split('\n'),rec.platform)) fail('integration completion marker');
      const parse = marker => parsePlatformMarkerRows(lines, marker);
      const sources = parse('SDK BOUNDS NATIVE SOURCE:'), rows = parse('SDK BOUNDS NATIVE RESULT:');
      if (sources.length !== 1 || rows.length !== 54 || !same(sources.map(x => x.data), rec.sdkBoundsNativeSources) ||
          !same(rows.map(x => x.data), rec.sdkBoundsNativeResults)) fail('missing, duplicate or altered bounds observations');
      const comparison = compareSdkBoundsNative({source:sources[0].data, rows:rows.map(x => x.data)}, {read:readRef});
      if (comparison.status !== 'BOUNDED_MATCH') fail('bounds comparison: ' + JSON.stringify(comparison));
      const ref = item => ({file:rec.file, sha256:rec.sha256, line:item.line,
        logLineSha256:sha(lines[item.line - 1]), observationSha256:sha(JSON.stringify(item.data))});
      for (const method of methods) {
        const selected = rows.filter(x => x.data.method === method);
        if (selected.length !== 18) fail('method case count');
        output[`Tmapv3.base.LatLngBounds#${method}`].platforms[rec.platform] = {
          log:{file:rec.file,sha256:rec.sha256}, run:rec.run,
          source:{observation:sources[0].data,ref:ref(sources[0])},
          cases:selected.map(x => ({observation:x.data,ref:ref(x)}))
        };
      }
    }
    return {byContract:output, issues:[]};
  } catch (error) {
    return {byContract:{}, issues:[{code:'sdk-bounds-native-observations-rejected', reason:String(error.message)}]};
  }
}
