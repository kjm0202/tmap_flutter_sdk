import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { reviewGenericDispatch } from '../generic_dispatch_reviews.mjs';

const fixtureUrl = new URL('./fixtures/generic_dispatch_probes.json', import.meta.url);

async function getPayload() {
  const manifestUrl = new URL('../baselines/production-2026-11-19-46fa62a7bb27.json', import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf-8'));
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf-8'));
  fixture.manifest = manifest;
  return fixture;
}

test('positive: all 14 resolved', async () => {
  const payload = await getPayload();
  const { resolved } = await reviewGenericDispatch(payload);

  const nonNull = resolved.filter(r => r.evidence && r.evidence.dedicatedReleaseId !== null);
  const nulls = resolved.filter(r => r.evidence && r.evidence.dedicatedReleaseId === null);

  const unmapped = resolved.filter(r => r.evidence && r.evidence.dedicatedReleaseId === null);
  const distinctUnmapped = [...new Set(unmapped.map(r => r.evidence.canonicalId))];

  assert.strictEqual(nonNull.length, 9);
  assert.strictEqual(nulls.length, 5);
  assert.strictEqual(distinctUnmapped.length, 4);
});

test('negative: null extensions', async () => {
  const payload = await getPayload();
  payload.runtime.bridgeSourceHashes.extensions = null;
  const { resolved } = await reviewGenericDispatch(payload);
  assert.strictEqual(resolved.length, 0);
});

test('negative: failed auth', async () => {
  const payload = await getPayload();
  payload.runtime.auth = 'failed';
  const { resolved } = await reviewGenericDispatch(payload);
  assert.strictEqual(resolved.length, 0);
});

test('negative: wrong pin', async () => {
  const payload = await getPayload();
  payload.runtime.networkScripts[0].pinned = false;
  const { resolved } = await reviewGenericDispatch(payload);
  assert.strictEqual(resolved.length, 0);
});

test('negative: duplicate observation', async () => {
  const payload = await getPayload();
  payload.runtime.bridgeObservations.push(payload.runtime.bridgeObservations[0]);
  const { resolved } = await reviewGenericDispatch(payload);
  assert.strictEqual(resolved.length, 13);
});

test('negative: extra actual field', async () => {
  const payload = await getPayload();
  payload.runtime.bridgeObservations[0].actual = 'unexpected';
  const { resolved } = await reviewGenericDispatch(payload);
  assert.strictEqual(resolved.length, 13);
});

test('negative: wrong drawing pointer environment', async () => {
  const payload = await getPayload();
  const drawingPointer = payload.runtime.bridgeObservations.find(o => o.id === 'Drawing.pointer.generic-adapter');
  drawingPointer.environment = 'wrong';
  const { resolved } = await reviewGenericDispatch(payload);
  assert.strictEqual(resolved.length, 13);
});

test('negative: change DotMap canonical status', async () => {
  const payload = await getPayload();
  const row = payload.rows.find(r => r.id === 'Tmapv3.extension.DotMap');
  row.status = 'supported';
  const { resolved } = await reviewGenericDispatch(payload);
  assert.strictEqual(resolved.length, 13);
});

test('negative: InfoWindow first dartCandidate.id to Unrelated', async () => {
  const payload = await getPayload();
  const infoWindow = payload.rows.find(r => r.id === 'Tmapv3.mapobject.InfoWindow');
  infoWindow.dartCandidates[0].id = 'Unrelated';
  const { open, resolved } = await reviewGenericDispatch(payload);
  assert.strictEqual(open.length, 1);
  assert.strictEqual(resolved.length, 13);
});
