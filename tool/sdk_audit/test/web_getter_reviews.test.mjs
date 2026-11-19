import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reviewAbsentWebGetters } from '../web_getter_reviews.mjs';

function getFreshData() {
  const { issues, runtime, libFingerprint, bridgeFingerprint } = JSON.parse(readFileSync(new URL('./fixtures/web_getter_probe.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../baselines/production-2026-11-19-46fa62a7bb27.json', import.meta.url), 'utf8'));
  return { issues, runtime, libFingerprint, bridgeFingerprint, manifest };
}

test('web_getter_reviews positive', () => {
  const { issues, runtime, libFingerprint, bridgeFingerprint, manifest } = getFreshData();
  const result = reviewAbsentWebGetters({ issues, manifest, runtime, libFingerprint, bridgeFingerprint });

  assert.strictEqual(result.resolved.length, 6);
  assert.strictEqual(result.open.length, 0);

  const originalIds = result.resolved.map(r => r.original.id).sort();
  const expectedIds = issues.map(i => i.id).sort();
  assert.deepStrictEqual(originalIds, expectedIds);
});

test('web_getter_reviews negative cases', () => {
  // Neg 1: Add duplicate of first issue to issues array
  {
    const { issues, runtime, libFingerprint, bridgeFingerprint, manifest } = getFreshData();
    issues.push(issues[0]);
    const result = reviewAbsentWebGetters({ issues, manifest, runtime, libFingerprint, bridgeFingerprint });
    assert.strictEqual(result.resolved.length, 5);
    assert.strictEqual(result.open.length, 2);
    assert.ok(!result.resolved.some(r => r.original.id === issues[0].id));
  }

  // Neg 2: Duplicate first runtime.bridgeObservations
  {
    const { issues, runtime, libFingerprint, bridgeFingerprint, manifest } = getFreshData();
    runtime.bridgeObservations.push(runtime.bridgeObservations[0]);
    const result = reviewAbsentWebGetters({ issues, manifest, runtime, libFingerprint, bridgeFingerprint });
    assert.strictEqual(result.resolved.length, 5);
  }

  // Neg 3: Set first runtime.bridgeObservations[0].actual = 14
  {
    const { issues, runtime, libFingerprint, bridgeFingerprint, manifest } = getFreshData();
    runtime.bridgeObservations[0].actual = 14;
    const result = reviewAbsentWebGetters({ issues, manifest, runtime, libFingerprint, bridgeFingerprint });
    assert.strictEqual(result.resolved.length, 5);
  }

  // Neg 4: manifest.id = 'wrong'
  {
    const { issues, runtime, libFingerprint, bridgeFingerprint, manifest } = getFreshData();
    manifest.id = 'wrong';
    const result = reviewAbsentWebGetters({ issues, manifest, runtime, libFingerprint, bridgeFingerprint });
    assert.strictEqual(result.open.length, 6);
    assert.strictEqual(result.resolved.length, 0);
  }

  // Neg 5: runtime.auth = 'failed'
  {
    const { issues, runtime, libFingerprint, bridgeFingerprint, manifest } = getFreshData();
    runtime.auth = 'failed';
    const result = reviewAbsentWebGetters({ issues, manifest, runtime, libFingerprint, bridgeFingerprint });
    assert.strictEqual(result.open.length, 6);
    assert.strictEqual(result.resolved.length, 0);
  }
});
