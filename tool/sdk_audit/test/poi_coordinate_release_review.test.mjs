import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ROOT, fingerprint, sha } from '../common.mjs';
import { reviewReleasedPoiCoordinate as review } from '../poi_coordinate_release_review.mjs';

const MODEL = 'lib/src/models/poi_item.dart';
const OLD = 'cdeaaf2f2df2f41d076365e7b2f00b979ca3143efbc7637c75f2f5fafb8d94be';
const FIXED = '14890163bb8189d0167a926f68c5de8a4c6510533a31e16d969966b61424b80d';
const TARGET = { code: 'tdata-poi-coordinate-presence-observations-rejected', reason: 'library mismatch' };
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/legacy_native_adapter_cases.json.gz', import.meta.url))));
const manifest = JSON.parse(fs.readFileSync(new URL('../baselines/production-2026-11-19-46fa62a7bb27.json', import.meta.url)));
const libFingerprint = await fingerprint(path.join(ROOT, 'lib'));
const half = Math.floor(fixture.issues.length / 2);
const input = () => structuredClone({ issues: [...fixture.issues.slice(0, half), TARGET, ...fixture.issues.slice(half)],
  manifest, runtime: fixture.runtime, dart: fixture.dart, libFingerprint });

function assertOpen(value, name) {
  const snapshot = structuredClone(value);
  const result = review(value);
  assert.deepEqual(result, { open: snapshot.issues, resolved: [] }, name);
  assert.equal(result.open, value.issues, name);
  assert.deepEqual(value, snapshot, name);
}

test('reviews exactly the POI issue only for the reviewed fixed source', () => {
  const hash = sha(fs.readFileSync(path.join(ROOT, MODEL)));
  assert.ok([OLD, FIXED].includes(hash), 'unrecognized POI product source');
  const value = input(), snapshot = structuredClone(value), result = review(value);
  assert.deepEqual(value, snapshot);
  if (hash === OLD) {
    assert.deepEqual(result, { open: value.issues, resolved: [] });
    return;
  }
  assert.deepEqual(result.open, fixture.issues);
  assert.equal(result.resolved.length, 1);
  const resolved = result.resolved[0];
  assert.equal(resolved.original, value.issues[half]);
  assert.deepEqual(resolved.original, TARGET);
  assert.equal(resolved.status, 'REVIEWED_RELEASE_SUBSET_OF_HISTORICAL_RECEIPT');
  assert.equal(resolved.evidence.releasedPublicObservations, 1);
  assert.equal(resolved.evidence.backupOnlyConditions, 5);
  const facets = resolved.evidence.historical.facets;
  assert.deepEqual(facets.map(f => f.id).sort(), [
    'constructor.providedRetained', 'missing-invalid.legacyFallback', 'missing-invalid.nullAccess',
    'missing-invalid.unavailableSource', 'valid-and-fallback.completeFallback', 'valid-and-fallback.zeroValid'
  ]);
  for (const f of facets) {
    const released = f.id === 'missing-invalid.legacyFallback';
    assert.equal(f.released, released);
    assert.equal(f.productPass, false);
    assert.equal(f.status, released ? 'released-requires-live-proof' : 'historical-backup-call-only');
    if (released) assert.deepEqual(f.requires, ['PoiItem.point']);
  }
  assert.deepEqual(resolved.evidence.historical.original, TARGET);
});

test('rejects changed targets, current declarations, authentication and source bindings', () => {
  for (const [name, mutate] of Object.entries({
    reason: v => { v.issues[half].reason = 'input drift'; },
    extra: v => { v.issues[half].detail = 1; },
    duplicate: v => { v.issues.push({ ...TARGET }); },
    points: v => { v.dart.rows.push({ file: MODEL, id: 'PoiItem.pointOrNull', kind: 'getter' }); },
    coordinateSource: v => { v.dart.rows.push({ file: MODEL, id: 'PoiItem.coordinateSource', kind: 'field' }); },
    auth: v => { v.runtime.auth = 'failed'; },
    core: v => { v.runtime.networkScripts[0].sha256 = '0'.repeat(64); },
    manifest: v => { v.manifest.id = 'wrong'; },
    manifestSource: v => { v.manifest.sources[0].sha256 = '0'.repeat(64); },
    digest: v => { v.libFingerprint.sha256 = '0'.repeat(64); },
    source: v => { v.libFingerprint.files[MODEL] = '0'.repeat(64); v.libFingerprint.sha256 = sha(JSON.stringify(v.libFingerprint.files)); }
  })) {
    const value = input(); mutate(value); assertOpen(value, name);
  }
});
