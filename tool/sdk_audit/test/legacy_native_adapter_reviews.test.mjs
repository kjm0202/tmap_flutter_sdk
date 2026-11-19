import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { reviewLegacyNativeAdapters } from '../legacy_native_adapter_reviews.mjs';

function getFreshData() {
  const buffer = readFileSync(new URL('./fixtures/legacy_native_adapter_cases.json.gz', import.meta.url));
  const fixture = JSON.parse(gunzipSync(buffer).toString());
  const manifest = JSON.parse(readFileSync(new URL('../baselines/production-2026-11-19-46fa62a7bb27.json', import.meta.url), 'utf8'));
  return { ...fixture, manifest };
}

test('legacy native adapter reviews positive', () => {
  const data = getFreshData();
  const result = reviewLegacyNativeAdapters(data);

  // Positive: resolves exactly its nine originals
  assert.strictEqual(result.resolved.length, 9);

});

test('legacy native adapter reviews historical fixture', () => {
  const data = getFreshData();
  const historicalIssues = JSON.parse(readFileSync(new URL('./fixtures/historical_dispatch_rejections.json', import.meta.url), 'utf8'));

  data.issues = historicalIssues;
  const originalInput = structuredClone(data);

  const result = reviewLegacyNativeAdapters(data);

  // Require resolved originals exact ordered six
  assert.strictEqual(result.resolved.length, 6);
  assert.deepStrictEqual(result.resolved.map(r => r.original), historicalIssues);

  // Evidence nativeClass SdkNativeEvents
  for (const r of result.resolved) {
    assert.strictEqual(r.evidence.nativeClass, 'SdkNativeEvents');
  }

  // Nonempty proof.scenarios[0].methods each
  for (const r of result.resolved) {
    assert.ok(r.evidence.scenarios[0].methods.length > 0);
  }

  // No mutation
  assert.deepStrictEqual(data, originalInput);

  // Wrong issue reason stays
  const dataWithWrongReason = structuredClone(data);
  dataWithWrongReason.issues[0].reason = 'wrong';
  const resultWithWrongReason = reviewLegacyNativeAdapters(dataWithWrongReason);
  assert.strictEqual(resultWithWrongReason.open.length, 1);
  assert.strictEqual(resultWithWrongReason.open[0].code, historicalIssues[0].code);

  // Dart SdkNativeEvents.onMarkerInvocation disables
  data.dart.rows.push({id: "SdkNativeEvents.onMarkerInvocation", kind: "method", file: "lib/test.dart"});
  const resultWithInvocation = reviewLegacyNativeAdapters(data);
  assert.strictEqual(resultWithInvocation.resolved.length, 0);
});


test('legacy native adapter reviews negative cases', () => {
  // Neg: Stale baseline
  {
    const data = getFreshData();
    data.manifest.version = 'stale';
    const result = reviewLegacyNativeAdapters(data);
    assert.strictEqual(result.resolved.length, 0);
  }

  // Neg: Wrong auth
  {
    const data = getFreshData();
    data.runtime.auth = 'invalid';
    const result = reviewLegacyNativeAdapters(data);
    assert.strictEqual(result.resolved.length, 0);
  }

  // Neg: Added TMapController.sdkEvents getter
  {
    const data = getFreshData();
    data.dart.rows.push({id:"TMapController.sdkEvents",kind:"getter",file:"lib/test.dart"});
    const result = reviewLegacyNativeAdapters(data);
    assert.deepStrictEqual(result.open, data.issues);
    assert.strictEqual(result.resolved.length, 0);
  }

  // Neg: Conflicting duplicate code
  {
    const data = getFreshData();
    data.issues.push({...data.issues[0], reason: "different"});
    const result = reviewLegacyNativeAdapters(data);
    assert.strictEqual(result.open.length, 2);
    assert.strictEqual(result.resolved.length, 8);
  }

  // Mutation and equality
  {
    const data = getFreshData();
    const originalInput = structuredClone(data);
    const result = reviewLegacyNativeAdapters(data);
    assert.deepStrictEqual(result.resolved.map(r => r.original), data.issues);
    assert.deepStrictEqual(data, originalInput);
  }
});
