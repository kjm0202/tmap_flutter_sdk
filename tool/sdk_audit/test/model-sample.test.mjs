import assert from 'node:assert';
import { test, describe, beforeEach, afterEach } from 'node:test';
import { mkdtemp, cp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadComparisons, getHistoricalEvidence } from '../model-sample.mjs';
import { ROOT } from '../common.mjs';
import { readFileSync } from 'node:fs';

describe('model-sample', () => {
    let tempDir;
    let comparisons;
    let validReport;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'sdk-audit-test-'));
        
        // Setup checkpoint directory
        const checkpointDir = join(tempDir, 'docs/sdk-audit/checkpoints/2026-11-19/paired-runtime');
        
        // Copy real files
        const realCheckpointDir = join(ROOT, 'docs/sdk-audit/checkpoints/2026-11-19/paired-runtime');
        await cp(realCheckpointDir, checkpointDir, { recursive: true });

        // Copy model files
        await cp(join(ROOT, 'lib/src/models/point.dart'), join(tempDir, 'lib/src/models/point.dart'), { recursive: true });
        await cp(join(ROOT, 'lib/src/models/lat_lng.dart'), join(tempDir, 'lib/src/models/lat_lng.dart'), { recursive: true });

        comparisons = JSON.parse(readFileSync(join(checkpointDir, 'comparisons.json'), 'utf8'));

        validReport = {
            baselineId: comparisons.baselineManifestId,
            sdkSha256: comparisons.sdkSha256,
            libFingerprint: {
                files: Object.fromEntries(
                    Object.entries(comparisons.publishedFlutterModelSources).map(([file, info]) => [file, info.testedSha256])
                )
            }
        };
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true });
    });

    test('loadComparisons returns records for valid inputs', () => {
        const result = loadComparisons(validReport, tempDir);
        assert.notStrictEqual(result, null, 'Should load comparisons successfully');
        assert.strictEqual(result.baselineManifestId, comparisons.baselineManifestId);
    });

    test('loadComparisons returns null for altered summary', () => {
        const invalidReport = { ...validReport, baselineId: 'wrong-baseline' };
        assert.strictEqual(loadComparisons(invalidReport, tempDir), null, 'Should return null for wrong baselineId');
    });

    test('loadComparisons returns null for wrong sdkSha256', () => {
        const invalidReport = { ...validReport, sdkSha256: 'wrong-sha' };
        assert.strictEqual(loadComparisons(invalidReport, tempDir), null, 'Should return null for wrong sdkSha256');
    });

    test('loadComparisons returns null for altered raw platform', async () => {
        // Alter one of the observation files
        const artifactFile = comparisons.artifacts.web.file;
        const artifactPath = join(tempDir, 'docs/sdk-audit/checkpoints/2026-11-19/paired-runtime', artifactFile);
        await writeFile(artifactPath, 'altered content');
        
        assert.strictEqual(loadComparisons(validReport, tempDir), null, 'Should return null for altered artifact');
    });

    test('loadComparisons returns null for stale model file', async () => {
        const modelFile = 'lib/src/models/point.dart';
        const modelPath = join(tempDir, modelFile);
        await writeFile(modelPath, 'altered content');
        
        assert.strictEqual(loadComparisons(validReport, tempDir), null, 'Should return null for stale model file');
    });

    test('getHistoricalEvidence returns null for null comparisons', () => {
        assert.strictEqual(getHistoricalEvidence({ id: 'any' }, null), null);
    });

    test('getHistoricalEvidence returns positive result with correct historical build', () => {
        const row = { id: 'Tmapv3.base.Point#getX' };
        const evidence = getHistoricalEvidence(row, comparisons);
        assert.notStrictEqual(evidence, null);
        assert.strictEqual(evidence.sourceFingerprint, comparisons.sourceFingerprint);
    });

    test('getHistoricalEvidence asserts correct hashes and upstream conflict', () => {
        // Point
        const pointRow = { id: 'Tmapv3.base.Point#getX' };
        const pointEvidence = getHistoricalEvidence(pointRow, comparisons);
        assert.notStrictEqual(pointEvidence.currentDartLeafHash, null);
        assert.strictEqual(pointEvidence.leaf, 'lib/src/models/point.dart');
        assert.strictEqual(pointEvidence.digest, comparisons.publishedFlutterModelSources['lib/src/models/point.dart'].testedSha256);

        // LatLng
        const latLngRow = { id: 'Tmapv3.base.LatLng#lat' };
        const latLngEvidence = getHistoricalEvidence(latLngRow, comparisons);
        assert.notStrictEqual(latLngEvidence.currentDartLeafHash, null);
        assert.strictEqual(latLngEvidence.leaf, 'lib/src/models/lat_lng.dart');
        assert.strictEqual(latLngEvidence.digest, comparisons.publishedFlutterModelSources['lib/src/models/lat_lng.dart'].testedSha256);

        // Offset upstream
        const offsetRow = { id: 'Tmapv3.base.Point#offset' };
        const offsetEvidence = getHistoricalEvidence(offsetRow, comparisons);
        assert.notStrictEqual(offsetEvidence.upstreamConflict, undefined);
        assert.strictEqual(offsetEvidence.upstreamConflict.id, 'Tmapv3.base.Point#offset::mutation');
    });
});
