import {isDeepStrictEqual as same, types} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, sha} from './common.mjs';
import {verifySdkProjectionFacetAdaptations, projectionFacetContracts} from './sdk_projection_facet_adaptation_verification.mjs';

const BASE = '82f84e9f0d35001b7ae3605d970fb1645916494ba172a6144665573b0d2d7714';
const SDK = '5290e0fd7428e7d7185c75e60666adb8a5f804f84bbc57b7245d60ecbc61b66e';
const platforms = ['web', 'android', 'ios'];
const dimensions = ['inputs-defaults', 'returns-types', 'mutation-identity', 'errors', 'lifecycle-events', 'dispatch'];
const member = 'SdkUtilitiesNative.callProjection';
const file = 'lib/src/models/sdk_utilities_native.dart';
const signature = 'Future<Object?> callProjection(String name, [List<Object?> args = const []])';

function candidate(row) {
  const c = row?.dartCandidates;
  return Array.isArray(c) && c.length === 1 && c[0].id === member &&
    c[0].file === file && c[0].signature === signature && Number.isInteger(c[0].line) && c[0].line > 0;
}
function writable(row, key) {
  const descriptor = Object.getOwnPropertyDescriptor(row, key);
  return descriptor ? Object.hasOwn(descriptor, 'value') && descriptor.writable === true : Object.isExtensible(row);
}
function write(row, key, value) {
  if (Object.hasOwn(row, key)) row[key] = value;
  else Object.defineProperty(row, key, {value, writable: true, configurable: true, enumerable: true});
}
function prepare(input) {
  const gate = verifySdkProjectionFacetAdaptations(input);
  if (gate.issues.length || !same(Object.keys(gate.byContract).sort(), [...projectionFacetContracts].sort())) return null;
  const result = {};
  for (const id of projectionFacetContracts) {
    const entry = gate.byContract[id];
    if (entry.status !== 'reviewed-adaptation' || !platforms.every(p => entry.platforms?.[p])) return null;
    const observations = Object.fromEntries(platforms.map(platform => [platform, {
      id: `sdk-projection-facet-adaptation:${platform}:${id}`, contract: id,
      dartMember: member, platform, status: 'adaptation-match', dimensions: [...dimensions],
      count: 1, actualSha256: sha(JSON.stringify(entry.platforms[platform])), platformLog: entry.platforms[platform].log,
    }]));
    result[id] = {observations, verification: {
      baselineId: BASE, libSha256: entry.libFingerprintSha256, scope: entry.scope,
      sourceReview: {variant: 'sdk-projection-native-argument', contract: id, dartMember: member,
        scope: entry.scope, strictReview: entry.sourceReview, adaptation: entry.adaptation, limitations: entry.adaptation.limitations},
      platforms: Object.fromEntries(platforms.map(p => [p, Object.fromEntries(dimensions.map(d => [d, [observations[p].id]]))])),
    }};
  }
  return result;
}

/** Atomically attaches only the 24 source-reviewed argument facets. */
export function applySdkProjectionFacetContractProof(input) {
  try {
    const prepared = prepare(input);
    if (!prepared) return [];
    const targets = projectionFacetContracts.map(id => input.rows.find(r => r.id === id));
    if (targets.some(row => !row || types.isProxy(row) || !candidate(row) || row.status !== 'candidate-unverified' ||
      row.verification != null || row.proofProblems?.length ||
      !same(row.platforms, Object.fromEntries(platforms.map(p => [p, 'candidate-unverified']))) ||
      !['status', 'proofProblems', 'platforms', 'verification'].every(key => writable(row, key)))) return [];
    for (const row of targets) {
      write(row, 'status', 'reviewed-adaptation');
      write(row, 'proofProblems', []);
      write(row, 'platforms', Object.fromEntries(platforms.map(p => [p, 'verified'])));
      write(row, 'verification', prepared[row.id].verification);
    }
    return projectionFacetContracts.flatMap(id => platforms.map(p => prepared[id].observations[p]));
  } catch { return []; }
}

/** Revalidates source, actual logs, run bindings and every recorded proof. */
export function validSdkProjectionFacetContractProofs(report, {root = ROOT} = {}) {
  try {
    if (report?.baselineId !== BASE || report.sdkSha256 !== SDK) return Object.freeze({});
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tool/sdk_audit/baselines/2026-11-17-production.json')));
    const prepared = prepare({rows: report.rows, manifest, runtime: {platformEvidence: report.platformEvidence}, libFingerprint: report.libFingerprint, root});
    if (!prepared) return Object.freeze({});
    const seen = new Map();
    for (const item of report.observations || []) seen.set(item.id, seen.has(item.id) ? null : item);
    for (const id of projectionFacetContracts) {
      const row = report.rows.find(r => r.id === id), proof = prepared[id];
      if (!candidate(row) || row.status !== 'reviewed-adaptation' || !same(row.proofProblems, []) ||
        !same(row.verification, proof.verification) || !same(row.platforms, Object.fromEntries(platforms.map(p => [p, 'verified']))) ||
        !platforms.every(p => same(seen.get(proof.observations[p].id), proof.observations[p]))) return Object.freeze({});
    }
    return Object.freeze(Object.fromEntries(projectionFacetContracts.map(id => [id, true])));
  } catch { return Object.freeze({}); }
}
