import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reviewAdditionalBridgeTargets } from '../additional_bridge_reviews.mjs';

function getFreshData() {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/related_bridge_probes.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../baselines/production-2026-11-19-46fa62a7bb27.json', import.meta.url), 'utf8'));
  return { ...fixture, manifest };
}

test('additional bridge reviews positive', () => {
  const data = getFreshData();
  const result = reviewAdditionalBridgeTargets(data);

  assert.strictEqual(result.resolved.length, 7);
  // Assert signed-zero bearing and preserve mobile-helper.realToScreen sample-match
  assert.deepEqual(result.resolved.find(r=>r.original.id==='mobile-helper.getBearing').evidence.observation.expected,{bearing:{special:'-0'},__tmapCameraNumberTag:true});
  assert.strictEqual(data.runtime.bridgeObservations.find(r => r.id === 'mobile-helper.realToScreen').status, 'sample-match');
  assert.strictEqual(result.resolved.find(r => r.id === 'mobile-helper.realToScreen'), undefined);
  // Neg 5: Unknown IDs or statuses preserved
  {
    const data = getFreshData();
    data.issues.push({ id: 'unknown-id', status: 'unknown-status' });
    const result = reviewAdditionalBridgeTargets(data);
    assert.ok(result.open.some(r => r.id === 'unknown-id'));
  }
});

test('additional bridge reviews negative cases', () => {
  // Neg 1: runtime.bridgeSourceHashes.mobileHelpers -> only one Web row resolves
  {
    const data = getFreshData();
    // Simulate negative: modify runtime
    data.runtime.bridgeSourceHashes.mobileHelpers = 'web';
    const result = reviewAdditionalBridgeTargets(data);
    assert.strictEqual(result.resolved.length, 1);
  }

  // Neg 2: Duplicate web.realToScreen observation -> only six resolve
  {
    const data = getFreshData();
    // Simulate duplicate observation
    const webRecord = data.runtime.bridgeObservations.find(r=>r.id==='web.realToScreen');
    data.runtime.bridgeObservations.push({ ...webRecord });
    const result = reviewAdditionalBridgeTargets(data);
    assert.strictEqual(result.resolved.length, 6);
  }

  // Neg 3: Forged expected shape or add 'actual' even though it matches -> affected stays open
  {
    const data = getFreshData();
    // Simulate forged 'actual'
    data.runtime.bridgeObservations[0].actual = 'forged';
    const result = reviewAdditionalBridgeTargets(data);
    assert.strictEqual(result.open.length, 1);
  }

  // Neg 4: Wrong auth -> none resolve
  {
    const data = getFreshData();
    data.runtime.auth = 'wrong';
    const result = reviewAdditionalBridgeTargets(data);
    assert.strictEqual(result.resolved.length, 0);
  }
  // Neg 5: Unknown IDs or statuses preserved
  {
    const data = getFreshData();
    data.issues.push({ id: 'unknown-id', status: 'unknown-status' });
    const result = reviewAdditionalBridgeTargets(data);
    assert.ok(result.open.some(r => r.id === 'unknown-id'));
  }
});
