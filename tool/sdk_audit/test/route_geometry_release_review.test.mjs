import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { ROOT, fingerprint, sha } from '../common.mjs';
import { readRouteGeometryPlatformScope } from '../route_geometry_platform_scope.mjs';
import { reviewReleasedRouteGeometry as review } from '../route_geometry_release_review.mjs';

const TARGET = { code: 'tdata-route-geometry-observations-rejected', reason: 'library mismatch' };
const POSITIVE = 'docs/sdk-audit/checkpoints/2026-11-19/typed-response-positive-coordinate-replay.json.gz';
const SERVICE = 'lib/src/services/tdata_service.dart';
const MODEL = 'lib/src/models/route_info.dart';
const RELEASED = 'segments-and-snapshot.legacyPath';
const FACETS = [
    'segments-and-snapshot.boundaries', 'segments-and-snapshot.extraValues', 'segments-and-snapshot.guideExtra',
    'segments-and-snapshot.independentImmutable', RELEASED, 'segments-and-snapshot.retainedUnknown',
    'service-results.carRaw', 'service-results.carSegments', 'service-results.pedestrianRaw', 'service-results.pedestrianSegments'
];

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/legacy_native_adapter_cases.json.gz', import.meta.url))));
const manifest = JSON.parse(fs.readFileSync(new URL('../baselines/production-2026-11-19-46fa62a7bb27.json', import.meta.url), 'utf8'));
const libFingerprint = await fingerprint(path.join(ROOT, 'lib'));
const half = Math.floor(fixture.issues.length / 2);

/** A fresh clone of the real inputs; the target sits between the fixture's own issues. */
const input = () => structuredClone({
    issues: [...fixture.issues.slice(0, half), TARGET, ...fixture.issues.slice(half)],
    manifest, runtime: fixture.runtime, libFingerprint, dart: fixture.dart
});

function assertOpen(value, name) {
    const snapshot = structuredClone(value);
    const result = review(value);
    assert.deepEqual(result, { open: snapshot.issues, resolved: [] }, name);
    assert.equal(result.open, value.issues, name);
    assert.deepEqual(value, snapshot, name);
}

describe('reviewReleasedRouteGeometry', () => {
    test('accepts exactly the original for the current checkout with all ten facets', () => {
        const value = input();
        const snapshot = structuredClone(value);
        const result = review(value);
        assert.deepEqual(value, snapshot);
        assert.equal(result.resolved.length, 1);
        const [resolved] = result.resolved;
        assert.equal(resolved.original, value.issues[half]);
        assert.deepEqual(resolved.original, TARGET);
        assert.deepEqual(result.open, fixture.issues);
        assert.equal(resolved.status, 'REVIEWED_RELEASE_SUBSET_OF_HISTORICAL_RECEIPT');
        assert.equal(resolved.evidence.releasedPublicObservations, 1);
        assert.equal(resolved.evidence.backupOnlyConditions, 9);
        assert.deepEqual(resolved.evidence.notReleaseBehavior, ['rawResponse', 'lineSegments']);
        const { facets, original } = resolved.evidence.historical;
        assert.deepEqual(original, TARGET);
        assert.deepEqual(facets.map(f => f.id), FACETS);
        for (const f of facets) {
            assert.equal(f.productPass, false, f.id);
            assert.equal(f.released, f.id === RELEASED, f.id);
            assert.equal(f.status, f.id === RELEASED ? 'released-requires-live-proof' : 'historical-backup-call-only', f.id);
        }
        assert.deepEqual(facets.find(f => f.id === RELEASED).requires, ['RouteInfo.path']);
        const platform = resolved.evidence.platform;
        const receipt = JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT, POSITIVE))));
        assert.equal(platform.sourceGroup, 'typedResponse');
        assert.equal(platform.scope, receipt.scope);
        assert.deepEqual(platform.hashes.positiveCheckpoint, { file: POSITIVE, sha256: sha(fs.readFileSync(path.join(ROOT, POSITIVE))) });
        for (const name of ['android', 'ios', 'web']) {
            assert.equal(platform.platforms[name].device, receipt.platforms[name].device);
            assert.deepEqual(platform.platforms[name].sourceHashes, receipt.platforms[name].sourceHashes);
            assert.deepEqual(platform.platforms[name].samples, receipt.platforms[name].samples);
        }
    });

    test('rejects a forged unrelated current lib leaf even with a recomputed digest', () => {
        const value = input();
        const file = Object.keys(value.libFingerprint.files).find(f => f !== MODEL && f !== SERVICE);
        value.libFingerprint.files[file] = '0'.repeat(64);
        value.libFingerprint.sha256 = sha(JSON.stringify(value.libFingerprint.files));
        assertOpen(value, file);
    });

    test('binds each source phase to its own genuine receipt and local bytes', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'route-scope-'));
        try {
            for (const dir of ['lib', 'example/test_driver/bridge', 'tool/sdk_audit/baselines', 'docs/sdk-audit/checkpoints/2026-11-19']) {
                fs.cpSync(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
            }
            const read = fp => readRouteGeometryPlatformScope({ root, manifest, runtime: fixture.runtime, libFingerprint: fp });
            assert.equal(read(libFingerprint)?.sourceGroup, 'typedResponse');
            const checkpoint = path.join(root, POSITIVE);
            const original = fs.readFileSync(checkpoint);
            fs.writeFileSync(checkpoint, Buffer.concat([original, Buffer.from('altered')]));
            assert.equal(read(libFingerprint), null, 'altered receipt');
            fs.writeFileSync(checkpoint, original);
            const scenario = path.join(root, 'example/test_driver/bridge/tdata_coordinate_route.dart');
            fs.appendFileSync(scenario, '\n');
            assert.equal(read(libFingerprint), null, 'altered scenario source');
            fs.copyFileSync(path.join(ROOT, 'example/test_driver/bridge/tdata_coordinate_route.dart'), scenario);
            const other = Object.keys(libFingerprint.files).find(f => ![MODEL, SERVICE].includes(f));
            fs.appendFileSync(path.join(root, other), '\n');
            assert.equal(read(libFingerprint), null, 'altered unrelated local lib file');
            fs.copyFileSync(path.join(ROOT, other), path.join(root, other));
            for (const [phase, modelRev, serviceRev] of [
                ['round8', '96124428c7c0', '3a1bf7de0019'],
                ['corrected', '3a2e91cb51b7', '3a2e91cb51b7'],
            ]) {
                const fp = structuredClone(libFingerprint);
                for (const [file, rev] of [[MODEL, modelRev], [SERVICE, serviceRev]]) {
                    const bytes = execFileSync('git', ['-C', ROOT, 'show', `${rev}:${file}`]);
                    fs.writeFileSync(path.join(root, file), bytes);
                    fp.files[file] = sha(bytes);
                }
                fp.sha256 = sha(JSON.stringify(fp.files));
                const scope = read(fp);
                assert.equal(scope?.sourceGroup, phase);
                assert.ok(scope.hashes.platformCheckpoint);
                assert.ok(scope.hashes.liveCheckpoint);
                assert.equal(scope.hashes.positiveCheckpoint, undefined);
                assert.equal(read(libFingerprint), null, 'current fingerprint cannot use old bytes');
            }
            const mixed = structuredClone(libFingerprint);
            const oldModel = execFileSync('git', ['-C', ROOT, 'show', `96124428c7c0:${MODEL}`]);
            fs.writeFileSync(path.join(root, MODEL), oldModel);
            fs.copyFileSync(path.join(ROOT, SERVICE), path.join(root, SERVICE));
            mixed.files[MODEL] = sha(oldModel);
            mixed.sha256 = sha(JSON.stringify(mixed.files));
            assert.equal(read(mixed), null, 'mixed phases cannot share evidence');
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    test('keeps an altered, extended or duplicated original open', () => {
        for (const [name, change] of Object.entries({
            reason: issues => issues[half].reason = 'input drift',
            'extra field': issues => issues[half].detail = 1,
            'missing reason': issues => delete issues[half].reason,
            duplicate: issues => issues.push({ ...TARGET })
        })) {
            const value = input();
            change(value.issues);
            assertOpen(value, name);
        }
    });

    test('keeps the original open when RouteInfo.rawResponse is declared', () => {
        const value = input();
        value.dart.rows.push({ file: MODEL, id: 'RouteInfo.rawResponse', kind: 'field' });
        assertOpen(value, 'rawResponse');
    });

    test('keeps the original open for wrong runtime auth or core script', () => {
        for (const [name, change] of Object.entries({
            auth: r => r.auth = 'failed',
            core: r => r.networkScripts[0].sha256 = '0'.repeat(64),
            wrongRole: r => r.networkScripts[0].url = manifest.sources.find(s => s.role === 'flutter-web-fixed-cdn-versioned-core').url
        })) {
            const value = input();
            change(value.runtime);
            assert.equal(readRouteGeometryPlatformScope(value), null, name);
            assertOpen(value, name);
        }
    });

    test('accepts all three bootstrap hosts without changing review authority', () => {
        const sources = manifest.sources.filter(s => s.kind === 'bootstrap-cdn-versioned-core' && s.role === 'bootstrap-cdn-versioned-core');
        assert.equal(sources.length, 3);
        const expected = review(input());
        assert.equal(expected.resolved.length, 1);
        for (const source of sources) {
            const value = input();
            value.runtime.networkScripts[0].url = source.url;
            const result = review(value);
            assert.equal(result.resolved[0]?.evidence.platform.runtime.core.url, source.url);
            result.resolved[0].evidence.platform.runtime.core.url = expected.resolved[0].evidence.platform.runtime.core.url;
            assert.deepEqual(result, expected, source.url);
        }
    });

    test('keeps the original open for a forged model leaf or a bad aggregate digest', () => {
        const forged = input();
        forged.libFingerprint.files[MODEL] = '0'.repeat(64);
        forged.libFingerprint.sha256 = sha(JSON.stringify(forged.libFingerprint.files));
        assertOpen(forged, 'forged leaf with recomputed aggregate');
        const digest = input();
        digest.libFingerprint.sha256 = '0'.repeat(64);
        assertOpen(digest, 'bad aggregate alone');
    });
});
