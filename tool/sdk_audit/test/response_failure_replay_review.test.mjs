import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ROOT, fingerprint, sha } from '../common.mjs';
import { reviewResponseFailureReplay as review } from '../response_failure_replay_review.mjs';

const TARGET = { code: 'tdata-next-responseFailure-observations-rejected', reason: 'library mismatch' };
const OTHER = { code: 'tdata-next-rawQueryGuard-observations-rejected', reason: 'library mismatch' };
const RECEIPT = 'docs/sdk-audit/checkpoints/2026-11-19/typed-response-failure-three-platform.json.gz';
const COLLECTOR = 'tool/sdk_audit/tdata_next_adapter_observations.mjs';
const SCENARIO = 'example/test_driver/bridge/tdata_response_failure.dart';
const PROTOCOL = 'lib/src/services/tdata_protocol.dart';
const SERVICE = 'lib/src/services/tdata_service.dart';
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/legacy_native_adapter_cases.json.gz', import.meta.url))));
const read = file => JSON.parse(fs.readFileSync(file));
const manifest = read(path.join(ROOT, 'tool/sdk_audit/baselines/production-2026-11-19-46fa62a7bb27.json'));
const libFingerprint = await fingerprint(path.join(ROOT, 'lib'));
const input = () => structuredClone({ issues: [...fixture.issues, TARGET, OTHER], manifest, runtime: fixture.runtime, dart: fixture.dart, libFingerprint });

function rootWith(overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'response-replay-'));
  function mirror(rel) {
    const source = path.join(ROOT, rel), nested = Object.keys(overrides).filter(f => f === rel || f.startsWith(rel + '/'));
    if (!nested.length) return fs.symlinkSync(source, path.join(dir, rel));
    if (nested.includes(rel)) return;
    fs.mkdirSync(path.join(dir, rel), { recursive: true });
    for (const name of new Set([...fs.readdirSync(source), ...nested.map(f => f.slice(rel.length + 1).split('/')[0])])) mirror(path.join(rel, name));
  }
  for (const name of ['tool', 'docs', 'example', 'lib']) mirror(name);
  for (const [file, bytes] of Object.entries(overrides)) {
    if (bytes === null) continue;
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), bytes);
  }
  return dir;
}
function open(data, name) {
  const snapshot = structuredClone(data), result = review(data);
  assert.deepEqual(result, { open: data.issues, resolved: [] }, name);
  assert.equal(result.open, data.issues, name);
  assert.deepEqual(data, snapshot, name);
}

test('replays exactly the fixed 14-assertion cohort and retains all other issues', () => {
  const data = input(), snapshot = structuredClone(data), result = review(data);
  assert.deepEqual(data, snapshot);
  assert.deepEqual(result.open, [...fixture.issues, OTHER]);
  assert.equal(result.resolved.length, 1);
  const resolved = result.resolved[0], evidence = resolved.evidence;
  assert.equal(resolved.original, data.issues.at(-2));
  assert.equal(resolved.status, 'REVIEWED_CORRECTED_FIXED_COHORT_REPLAY');
  assert.equal(Object.values(evidence.originalCases).flat().length, 14);
  assert.equal(evidence.checkpoint.sha256, '161d198cdda84f19f2c2f7334aed9968aefcc9e91ce3efff4391630be52e741f');
  assert.deepEqual(evidence.official.records.map(r => r.role).sort(), ['documentation-host-example-core', 'flutter-web-fixed-cdn-versioned-core']);
  for (const phase of ['before', 'after']) for (const platform of ['android', 'ios', 'web']) {
    const run = evidence.runs[phase][platform];
    assert.equal(run.status, phase === 'before' ? 'FAIL' : 'PASS');
    assert.equal(Object.values(run.checks).flatMap(Object.values).length, 33);
  }
  assert.match(resolved.scope, /No live server error or raw callback equivalence/);
});

test('fails closed for absent, ambiguous, stale or unauthenticated inputs', () => {
  const cases = {
    noTarget: v => { v.issues = v.issues.filter(i => i.code !== TARGET.code); },
    duplicate: v => { v.issues.push({ ...TARGET }); },
    wrongReason: v => { v.issues.at(-2).reason = 'input drift'; },
    extraField: v => { v.issues.at(-2).file = 'other'; },
    noRuntime: v => { delete v.runtime; },
    auth: v => { v.runtime.auth = 'failed'; },
    bootstrap: v => { v.runtime.verifiedBootstrapDigest = '0'.repeat(64); },
    core: v => { v.runtime.networkScripts[0].sha256 = '0'.repeat(64); },
    wrongRole: v => { v.runtime.networkScripts[0].url = v.manifest.sources.find(s => s.role === 'flutter-web-fixed-cdn-versioned-core').url; },
    manifest: v => { v.manifest.sources.pop(); },
    noDart: v => { delete v.dart; },
    declarations: v => { v.dart.rows.pop(); },
    noFingerprint: v => { delete v.libFingerprint; },
    digest: v => { v.libFingerprint.sha256 = '0'.repeat(64); },
    protocol: v => { v.libFingerprint.files[PROTOCOL] = '0'.repeat(64); v.libFingerprint.sha256 = sha(JSON.stringify(v.libFingerprint.files)); },
    service: v => { v.libFingerprint.files[SERVICE] = '0'.repeat(64); v.libFingerprint.sha256 = sha(JSON.stringify(v.libFingerprint.files)); },
  };
  for (const [name, mutate] of Object.entries(cases)) { const value = input(); mutate(value); open(value, name); }
});

test('accepts each authenticated bootstrap host without changing review authority', () => {
  const sources = manifest.sources.filter(s => s.kind === 'bootstrap-cdn-versioned-core' && s.role === 'bootstrap-cdn-versioned-core');
  assert.equal(sources.length, 3);
  const expected = review(input());
  assert.equal(expected.resolved.length, 1);
  for (const source of sources) {
    const value = input();
    value.runtime.networkScripts[0].url = source.url;
    assert.deepEqual(review(value), expected, source.url);
  }
});

test('fails closed when pinned local inputs are missing or changed, including stale fingerprint', () => {
  const changed = file => Buffer.concat([fs.readFileSync(path.join(ROOT, file)), Buffer.from('\n')]);
  const cases = { collector: { [COLLECTOR]: changed(COLLECTOR) }, scenario: { [SCENARIO]: changed(SCENARIO) },
    missingScenario: { [SCENARIO]: null }, receipt: { [RECEIPT]: changed(RECEIPT) }, missingReceipt: { [RECEIPT]: null },
    protocol: { [PROTOCOL]: changed(PROTOCOL) }, service: { [SERVICE]: changed(SERVICE) } };
  for (const [name, files] of Object.entries(cases)) {
    const root = rootWith(files);
    try { open({ ...input(), root }, name); } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
  const root = rootWith({});
  try { assert.equal(review({ ...input(), root }).resolved.length, 1); } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

const raw = process.env.TMAP_AUDIT_RAW_OUT;
test('optional authenticated report preserves every other original issue', { skip: !raw }, () => {
  const report = read(path.join(raw, 'report.json'));
  const issues = [...report.issues];
  if (!issues.some(i => i.code === TARGET.code)) issues.push(...(report.resolvedIssues ?? []).map(r => r.original).filter(i => i?.code === TARGET.code));
  const result = review({ issues, manifest, runtime: read(path.join(raw, 'runtime.json')), dart: read(path.join(raw, 'dart.json')), libFingerprint: report.libFingerprint });
  assert.deepEqual(result.resolved.map(r => r.original), [TARGET]);
  assert.deepEqual(result.open, issues.filter(i => i.code !== TARGET.code));
});
