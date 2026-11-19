import {test, describe} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(readFileSync(f));
const sha = value => createHash('sha256').update(value).digest('hex');

const {reviewRetiredTDataTargets: review} = await import(path.join(__dirname, '../retired_tdata_targets.mjs'));
const manifestPath = path.join(__dirname, '../baselines/production-2026-11-19-46fa62a7bb27.json');

const rawDir = process.env.TMAP_AUDIT_RAW_OUT;
const report = rawDir ? read(path.join(rawDir, 'report.json')) : null;
const runtime = rawDir ? read(path.join(rawDir, 'runtime.json')) : null;
const manifest = read(manifestPath);

const input = report ? {
    issues: report.issues,
    manifest,
    runtime,
    libFingerprint: report.libFingerprint
} : null;

const targets = [
    'tdata-next-rawQueryGuard-observations-rejected',
    'tdata-next-fixedSnapshotGuard-observations-rejected',
    'tdata-bytes-cache-observations-rejected',
    'tdata-client-factory-classification-observations-rejected',
    'tdata-client-factory-close-observations-rejected',
    'tdata-fractional-timeout-observations-rejected',
    'tdata-response-cleanup-observations-rejected',
    'tdata-scalar-number-observations-rejected',
    'tdata-session-observations-rejected',
    'tdata-shared-debounce-observations-rejected',
    'tdata-transport-failure-observations-rejected',
    'tdata-scalar-compatibility-observations-rejected',
    'tdata-response-callback-observations-rejected',
    'tdata-callback-relation-observations-rejected',
    'tdata-callback-setup-rollback-observations-rejected',
    'tdata-request-e2e-observations-rejected',
    'sdk-tdata-lifecycle-observations-rejected',
    'tdata-geofencing-observations-rejected',
    'tdata-segmented-observations-rejected'
];

if (input && report.resolvedIssues) {
    const toInsert = report.resolvedIssues
        .map(entry => entry.original)
        .filter(original => targets.includes(original.code) && !report.issues.some(i => i.code === original.code));
    input.issues = [...input.issues, ...toInsert];
}

describe('retired_tdata_targets', () => {

    test('reviewRetiredTDataTargets', {skip: !input}, () => {
        const result = review(input);
        assert.deepEqual(
            result.resolved.map(x => x.original).sort((a, b) => a.code.localeCompare(b.code)),
            input.issues.filter(i => targets.includes(i.code)).sort((a, b) => a.code.localeCompare(b.code))
        );
        assert.deepEqual(result.open, input.issues.filter(i => !targets.includes(i.code)));

        const cases = {
            auth: x => x.runtime.auth = 'failed',
            otherManifest: x => x.manifest.sources.pop(),
            lib: x => x.libFingerprint.files['lib/new.dart'] = 'changed',
            // Only both projected route digests together form the accepted alternate
            partialProjectedRoute: x => {
                x.libFingerprint.files['lib/src/models/route_info.dart'] = '580ef713be665321429ad8df1e8582705156e4014c8eaefe01755bb5bb6fdd1a';
                x.libFingerprint.files['lib/src/services/tdata_service.dart'] = '42c6bd3d5077bf8b7fe1827f24ca36f9a4d13d8cf6ade2ec004d6cc30a13f3b7';
                x.libFingerprint.sha256 = sha(JSON.stringify(x.libFingerprint.files));
            },
            claimedProjectedRoute: x => {
                x.libFingerprint.files['lib/new.dart'] = 'changed';
                x.libFingerprint.sha256 = 'e8cd02a6820b47ae747a04db4c79e66baa49c26de4206d7d173c1dab7a5e60b0';
            },
            claimedPoiCoordinatePair: x => {
                x.libFingerprint.files['lib/new.dart'] = 'changed';
                x.libFingerprint.sha256 = '44766d5b0d5e7167dc9aebeadbe28b46444af7aca6677e619901581574b729c0';
            },
            // A self-consistent fingerprint of a different poi_item.dart than the
            // one on disk is rejected, even where it describes a verified tree
            stalePoiItemSource: x => {
                const routeTree = 'cdef2f2df2f41d076365e7b2f00b979ca3143efbc7637c75f2f5fafb8d94be';
                const poiTree = '14890163bb8189d0167a926f68c5de8a4c6510533a31e16d969966b61424b80d';
                const file = 'lib/src/models/poi_item.dart';
                x.libFingerprint.files[file] = x.libFingerprint.files[file] === routeTree ? poiTree : routeTree;
                x.libFingerprint.sha256 = sha(JSON.stringify(x.libFingerprint.files));
            },
            providedEvidence: x => x.runtime.platformEvidence = {bad: true},
            staleDigest: x => x.runtime.verifiedBootstrapDigest = 'stale',
            wrongSource: x => x.runtime.networkScripts[0].sha256 = 'wrong',
            unknownURL: x => x.runtime.networkScripts[0].url = 'https://invalid.example/other'
        };

        for (const [name, change] of Object.entries(cases)) {
            const v = structuredClone(input);
            change(v);
            const r = review(v);
            assert.equal(r.resolved.length, 0, name);
            assert.deepEqual(r.open, v.issues, name);
        }

        for (const change of [
            i => ({...i, reason: 'another failure'}),
            i => ({...i, reason: 'library mismatch', extra: 1})
        ]) {
            const v = structuredClone(input);
            v.issues = v.issues.map(i => targets.includes(i.code) ? change(i) : i);
            assert.equal(review(v).resolved.length, 0);
        }

        for (const target of targets) {
            const v = structuredClone(input);
            const duplicate = v.issues.find(i => i.code === target);
            if (!duplicate) continue;
            v.issues.push({...duplicate});
            assert.ok(review(v).resolved.every(r => r.original.code !== target));
        }
    });

    test('missing-auth/no-promotion', () => {
        const originalRecords = [
            {code: targets[0], reason: 'library mismatch'},
            {code: targets[1], reason: 'library mismatch'}
        ];
        const minimalInput = {
            issues: originalRecords,
            manifest: {sources: []},
            runtime: {auth: 'missing'},
            libFingerprint: {files: {}}
        };
        const r = review(minimalInput);
        assert.deepEqual(r.open, minimalInput.issues);
        assert.deepEqual(r.resolved, []);
    });
});
